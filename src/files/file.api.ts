/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import { pick, sortBy, sumBy } from 'lodash';
import Busboy from 'busboy';

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { ApiError } from '../common/api.error';
import { TableBlock, TableBlockBase, TableBlockMatch, TableBlockMatchResult } from '../releases/release.tableblock';
import { File } from './file';
import { logger } from '../common/logger';
import { Release } from '../releases/release';
import { ReleaseVersion } from '../releases/release.version';
import { ReleaseVersionFile } from '../releases/release.version.file';
import { Build } from '../builds/build';
import { FileUtil } from './file.util';
import { mimeTypeNames } from './file.mimetypes';

//const fileModule = require('../../modules/file');

export class FileApi extends Api {

	/**
	 * End-point for uploading files. Data can be sent either as entire body or
	 * as multipart, although only one file is allowed in a multipart body.
	 *
	 * @see POST /v1/files
	 * @param {Application.Context} ctx Koa context
	 */
	public async upload(ctx: Context) {

		// fail if no content type
		if (!ctx.get('content-type')) {
			throw new ApiError('Header "Content-Type" must be provided.').status(422);
		}

		// fail if no file type
		if (!ctx.query.type) {
			throw new ApiError('Query parameter "type" must be provided.').status(422);
		}

		// stream either directly from req or use a multipart parser
		let file: File;
		if (/multipart\/form-data/i.test(ctx.get('content-type'))) {
			file = await this.handleMultipartUpload(ctx);
		} else {
			file = await this.handleRawUpload(ctx);
		}
		return this.success(ctx, state.serializers.File.detailed(ctx, file), 201);
	}

	/**
	 * Deletes a file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async del(ctx: Context) {
		const file = await state.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if not owner
		if (!(file._created_by as any).equals(ctx.state.user._id)) {
			new ApiError('Permission denied, must be owner.').status(403);
		}

		// only allow inactive files (for now)
		if (file.is_active !== false) {
			new ApiError('Cannot remove active file.').status(400);
		}
		await file.remove();

		logger.info('[FileApi.del] File "%s" (%s) successfully removed.', file.name, file.id);
		return this.success(ctx, null, 204);
	}

	/**
	 * Returns details of a given file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async view(ctx: Context) {
		const file = await state.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if inactive and not owner
		let isOwner = ctx.state.user && (file._created_by as any).equals(ctx.state.user._id);
		if (!file.is_active && (!ctx.state.user || !isOwner)) {
			throw new ApiError('File "%s" is inactive.', ctx.params.id).status(ctx.state.user ? 403 : 401);
		}
		return this.success(ctx, state.serializers.File.detailed(ctx, file));
	}

	/**
	 * Looks for similar table files.
	 *
	 * @param {Application.Context} ctx Koa context
	 */
	public async blockmatch(ctx: Context) {

		const includeSameRelease = !!ctx.query.include_same_release;
		const rlsFields = ['_game', 'authors._user', 'versions.files._file', 'versions.files._compatibility'];
		const threshold = 50; // sum of matched bytes and object percentage must be >50%
		const file = await state.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if no table file
		if (file.getMimeCategory() !== 'table') {
			throw new ApiError('Can only match table files, this is a %s', file.getMimeCategory(), ctx.params.id).status(400);
		}
		const release = await state.models.Release.findOne({ 'versions.files._file': file._id }).populate(rlsFields.join(' ')).exec();

		// fail if not found
		if (!release) {
			throw new ApiError('Release reference missing.', ctx.params.id).status(400);
		}

		const result: TableBlockMatchResult = this.populateBlockmatch<TableBlockMatchResult>(ctx, release, file._id.toString());
		const matches = new Map<string, TableBlock[]>();
		const blocks = await state.models.TableBlock.find({ _files: file._id }).exec();
		// split blocks: { <file._id>: [ matched blocks ] }
		blocks.forEach((block: TableBlock) => {
			(block._files as File[]).forEach(f => {
				// don't match own id
				if (f.equals(file._id)) {
					return;
				}
				const fid = f.toString();
				if (!matches.has(fid)) {
					matches.set(fid, []);
				}
				matches.get(fid).push(block);
			});
		});
		// FIXME just fetch files, calc percentage, filter, THEN fetch releases for performance boost.
		const matchedReleases = await state.models.Release.find({ 'versions.files._file': { $in: Array.from(matches.keys()) } }).populate(rlsFields).exec();

		// map <file._id>: <release>
		let releases = new Map<string, Release>();
		matchedReleases.forEach(release => {
			release.versions.forEach(version => {
				version.files.forEach(file => {
					releases.set((file._file as File)._id.toString(), release);
				});
			});
		});
		const totalBytes = sumBy(blocks, b => b.bytes);
		result.matches = [];
		for (let [key, matchedBlocks] of matches) {
			const matchedBytes = sumBy(matchedBlocks, b => b.bytes);
			let match = this.populateBlockmatch<TableBlockMatch>(ctx, releases.get(key), key, {
				matchedCount: matchedBlocks.length,
				matchedBytes: matchedBytes,
				countPercentage: matchedBlocks.length / blocks.length * 100,
				bytesPercentage: matchedBytes / totalBytes * 100
			});
			result.matches.push(match);
		}
		result.matches = result.matches.filter(m => m.release && m.countPercentage + m.bytesPercentage > threshold);
		if (!includeSameRelease) {
			result.matches = result.matches.filter(m => m.release.id !== release.id);
		}
		result.matches = sortBy(result.matches, m => -(m.countPercentage + m.bytesPercentage));
		return this.success(ctx, result);
	}


	/**
	 * Searches a file with a given ID within a release and updates
	 * a given object with release, game, version and file.
	 * @param {Application.Context} ctx Koa context
	 * @param {Release} release Release to search in
	 * @param {string} fileId File ID to search for  (database _id as string)
	 * @param {object} base Object to be updated
	 */
	private populateBlockmatch<T extends TableBlockBase>(ctx: Context, release: Release, fileId: string, base: T = {} as T): T {
		if (!release) {
			return;
		}
		let rls = state.serializers.Release.simple(ctx, release);
		base.release = pick(rls, ['id', 'name', 'created_at', 'authors']) as Release;
		base.game = rls.game;
		release.versions.forEach(version => {
			version.files.forEach(versionFile => {
				if ((versionFile._file as File)._id.toString() === fileId) {
					base.version = pick(version.toObject(), ['version', 'released_at']) as ReleaseVersion;
					let f = versionFile.toObject();
					base.file = pick(f, ['released_at', 'flavor']) as ReleaseVersionFile;
					base.file.compatibility = f._compatibility.map((c: Build) => pick(c, ['id', 'label']));
					base.file.file = state.serializers.File.simple(ctx, versionFile._file as File);
				}
			});
		});
		return base;
	}

	/**
	 * Handles uploaded data posted as-is with a content type
	 *
	 * @param {Context} ctx Koa context
	 * @return {Promise<File>}
	 */
	private async handleRawUpload(ctx: Context): Promise<File> {

		if (!ctx.get('content-disposition')) {
			throw new ApiError('Header "Content-Disposition" must be provided.').status(422);
		}
		if (!/filename=([^;]+)/i.test(ctx.get('content-disposition'))) {
			throw new ApiError('Header "Content-Disposition" must contain file name.').status(422);
		}
		const validMimeTypes = [...mimeTypeNames, 'multipart/form-data' ];
		if (!validMimeTypes.includes(ctx.get('content-type'))) {
			throw new ApiError('Invalid "Content-Type" header "%s". Valid content types are: [ %s ]. You can also post multi-part binary data using "multipart/form-data".',
				ctx.get('content-type'), mimeTypeNames.join(', ')).status(422);
		}
		const filename = ctx.get('content-disposition').match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, '');
		logger.info('[FileApi.handleRawUpload] Starting file upload of "%s"...', filename);
		const fileData = {
			name: filename,
			bytes: ctx.get('content-length') || 0,
			variations: {},
			created_at: new Date(),
			mime_type: ctx.get('content-type'),
			file_type: ctx.query.type,
			_created_by: ctx.state.user._id
		};

		return FileUtil.create(ctx, fileData as File, ctx.req, { processInBackground: true });
	}

	/**
	 * Handles uploaded data posted as multipart.
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise<File>}
	 */
	private async handleMultipartUpload(ctx: Context): Promise<File> {

		if (!ctx.query.content_type) {
			throw new ApiError('Mime type must be provided as query parameter "content_type" when using multipart.').status(422);
		}

		if (!mimeTypeNames.includes(ctx.query.content_type)) {
			throw new ApiError('Invalid "Content-Type" parameter "%s". Valid content types are: [ %s ].', ctx.query.content_type).status(422);
		}

		let err:ApiError;
		const busboy = new Busboy({ headers: ctx.request.headers });
		const parseResult = new Promise<File>((resolve, reject) => {
			let numFiles = 0;
			busboy.on('file', (fieldname, stream, filename) => {
				numFiles++;
				if (numFiles > 1) {
					err = new ApiError('Multipart requests must only contain one file.').code('too_many_files').status(422);
					stream.resume();
					return;
				}
				logger.info('[FileApi.handleMultipartUpload] Starting file (multipart) upload of "%s"', filename);
				const fileData = {
					name: filename,
					bytes: 0,
					variations: {},
					created_at: new Date(),
					mime_type: ctx.query.content_type,
					file_type: ctx.query.type,
					_created_by: ctx.state.user._id
				};
				FileUtil.create(ctx, fileData as File, stream, { processInBackground: true })
					.then(file => resolve(file))
					.catch(reject);
			});
		});

		const parseMultipart = new Promise((resolve, reject) => {
			busboy.on('finish', resolve);
			busboy.on('error', reject);
			ctx.req.pipe(busboy);
		});

		const results = await Promise.all([parseResult, parseMultipart]);
		if (err) {
			logger.warn('[FileApi.handleMultipartUpload] Removing %s', results[0].toString());
			await results[0].remove();
			throw err;
		}
		return results[0];
	}
}