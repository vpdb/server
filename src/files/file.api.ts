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

import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { ApiError } from '../common/api.error';
import { File } from './file';

const _ = require('lodash');
const logger = require('winston');
const Busboy = require('busboy');

//const fileModule = require('../../modules/file');

export class FileApi extends Api {

	/**
	 * End-point for uploading files. Data can be sent either as entire body or
	 * as multipart, although only one file is allowed in a multipart body.
	 *
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

		// stream either directly from req or user a multipart parser
		let file: File;
		if (/multipart\/form-data/i.test(ctx.get('content-type'))) {
			file = await this.handleMultipartUpload(ctx);
		} else {
			file = await this.handleUpload(ctx);
		}
		return this.success(ctx, ctx.serializers.File.detailed(ctx, file), 201);
	}

	/**
	 * Deletes a file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async del(ctx: Context) {
		const file = await ctx.models.File.findOne({ id: ctx.params.id });

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

		logger.info('[api|file:delete] File "%s" (%s) successfully removed.', file.name, file.id);
		return this.success(ctx, null, 204);
	}

	/**
	 * Returns details of a given file.
	 * @param {Application.Context} ctx Koa context
	 */
	public async view(ctx: Context) {
		const file = await ctx.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if inactive and not owner
		let isOwner = ctx.state.user && file._created_by.equals(ctx.state.user._id);
		if (!file.is_active && (!ctx.state.user || !isOwner)) {
			throw new ApiError('File "%s" is inactive.', ctx.params.id).status(ctx.state.user ? 403 : 401);
		}
		return this.success(ctx, ctx.serializers.File.detailed(ctx, file));
	}

	/**
	 * Looks for similar table files.
	 *
	 * @param {Application.Context} ctx Koa context
	 */
	public async blockmatch(ctx: Context) {

		const includeSameRelease = !!ctx.query.include_same_release;
		const rlsFields = '_game authors._user versions.files._file versions.files._compatibility';
		const threshold = 50; // sum of matched bytes and object percentage must be >50%
		let result = {};
		const file = await ctx.models.File.findOne({ id: ctx.params.id });

		// fail if not found
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		// fail if no table file
		if (file.getMimeCategory() !== 'table') {
			throw new ApiError('Can only match table files, this is a %s', file.getMimeCategory(), ctx.params.id).status(400);
		}
		const release = await ctx.models.Release.findOne({ 'versions.files._file': file._id }).populate(rlsFields).exec();

		// fail if not found
		if (!release) {
			throw new ApiError('Release reference missing.', ctx.params.id).status(400);
		}
		this.splitReleaseFile(ctx, release, file._id.toString(), result);

		const matches = new Map();
		const blocks = await ctx.models.TableBlock.find({ _files: file._id }).exec();
		// split blocks: { <file._id>: [ matched blocks ] }
		blocks.forEach(block => {
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
		const matchedReleases = await ctx.models.Release.find({ 'versions.files._file': { $in: Array.from(matches.keys()) } }).populate(rlsFields).exec();

		// map <file._id>: <release>
		let releases = new Map();
		matchedReleases.forEach(release => {
			release.versions.forEach(version => {
				version.files.forEach(file => {
					releases.set(file._file._id.toString(), release);
				});
			});
		});
		const totalBytes = _.sumBy(blocks, b => b.bytes);
		result.matches = [];
		for (let [key, matchedBlocks] of matches) {
			const matchedBytes = _.sumBy(matchedBlocks, b => b.bytes);
			let match = {
				matchedCount: matchedBlocks.length,
				matchedBytes: matchedBytes,
				countPercentage: matchedBlocks.length / blocks.length * 100,
				bytesPercentage: matchedBytes / totalBytes * 100
			};
			splitReleaseFile(ctx, releases.get(key), key, match);
			result.matches.push(match);
		}
		result.matches = _.filter(result.matches, m => m.release && m.countPercentage + m.bytesPercentage > threshold);
		if (!includeSameRelease) {
			result.matches = _.filter(result.matches, m => m.release.id !== release.id);
		}
		result.matches = _.sortBy(result.matches, m => -(m.countPercentage + m.bytesPercentage));
		return this.success(ctx, result);
	}


	/**
	 * Searches a file with a given ID within a release and updates
	 * a given object with release, game, version and file.
	 * @param {Application.Context} ctx Koa context
	 * @param {Release} release Release to search in
	 * @param {string} fileId File ID to search for  (database _id as string)
	 * @param {object} result Object to be updated
	 */
	private splitReleaseFile(ctx: Context, release, fileId, result) {
		if (!release) {
			return;
		}
		let rls = ReleaseSerializer.simple(release, req);
		result.release = _.pick(rls, ['id', 'name', 'created_at', 'authors']);
		result.game = rls.game;
		release.versions.forEach(version => {
			version.files.forEach(versionFile => {
				if (versionFile._file._id.toString() === fileId) {
					result.version = _.pick(version.toObject(), ['version', 'released_at']);
					let f = versionFile.toObject();
					result.file = _.pick(f, ['released_at', 'flavor']);
					result.file.compatibility = f._compatibility.map(c => _.pick(c, ['id', 'label']));
					result.file.file = FileSerializer.simple(versionFile._file, req);
				}
			});
		});
	}

	/**
	 * Handles uploaded data posted as-is with a content type
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise.<FileSchema>}
	 */
	private async handleUpload(ctx: Context): Promise<File> {

		return Promise.try(() => {

			if (!req.headers['content-disposition']) {
				throw error('Header "Content-Disposition" must be provided.').status(422);
			}
			if (!/filename=([^;]+)/i.test(req.headers['content-disposition'])) {
				throw error('Header "Content-Disposition" must contain file name.').status(422);
			}
			const filename = req.headers['content-disposition'].match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, '');
			logger.info('[api|file:upload] Starting file upload of "%s"...', filename);
			const fileData = {
				name: filename,
				bytes: req.headers['content-length'] || 0,
				variations: {},
				created_at: new Date(),
				mime_type: req.headers['content-type'],
				file_type: req.query.type,
				_created_by: req.user._id
			};

			return fileModule.create(fileData, req, error, { processInBackground: true });
		});
	}

	/**
	 * Handles uploaded data posted as multipart.
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise.<FileSchema>}
	 */
	private async handleMultipartUpload(ctx: Context): Promise<File> {

		return Promise.try(() => {

			if (!req.query.content_type) {
				throw error('Mime type must be provided as query parameter "content_type" when using multipart.').status(422);
			}

			const busboy = new Busboy({ headers: req.headers });
			const parseResult = new Promise(function (resolve, reject) {

				let numFiles = 0;
				busboy.on('file', function (fieldname, stream, filename) {
					numFiles++;
					if (numFiles > 1) {
						return reject(error('Multipart requests must only contain one file.').status(422));
					}
					logger.info('[api|file:upload] Starting file (multipart) upload of "%s"...', filename);
					const fileData = {
						name: filename,
						bytes: 0,
						variations: {},
						created_at: new Date(),
						mime_type: req.query.content_type,
						file_type: req.query.type,
						_created_by: req.user._id
					};
					fileModule.create(fileData, stream, error, { processInBackground: true }).then(file => resolve(file)).catch(reject);
				});
			});

			const parseMultipart = new Promise((resolve, reject) => {
				busboy.on('finish', resolve);
				busboy.on('error', reject);
				req.pipe(busboy);
			});

			return Promise.all([parseResult, parseMultipart]).then(results => results[0]);
		});
	}

}