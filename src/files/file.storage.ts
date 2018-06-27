/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { createReadStream, stat, Stats } from 'fs';
import { promisify } from 'util';
import Busboy from 'busboy';

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/typings/context';
import { quota } from '../common/quota';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { processorQueue } from './processor/processor.queue';
import { File } from './file';
import { FileUtil } from './file.util';
import { mimeTypeNames } from './file.mimetypes';

const statAsync = promisify(stat);

/**
 * This deals with uploading and downloading files.
 *
 * When run on a separate server, this should be the only active API.
 */
export class FileStorage extends Api {

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
	 * Downloads a single file.
	 *
	 * @see GET /v1/files/:id
	 * @see GET /v1/files/:variation/:id
	 * @see GET /public/files/:id
	 * @see GET /public/files/:variation/:id
	 * @param {Context} ctx Koa context
	 */
	public async get(ctx: Context) {

		const [file, isFree] = await this.find(ctx);

		if (isFree) {
			return this.serve(ctx, file, ctx.params.variation);
		}

		// check the quota
		await quota.assert(ctx, file);

		// we're here, so serve!
		return await this.serve(ctx, file, ctx.params.variation);
	}

	/**
	 * Checks if a file exists.
	 *
	 * @see HEAD /v1/files/:id
	 * @see HEAD /v1/files/:variation/:id
	 * @see HEAD /public/files/:id
	 * @see HEAD /public/files/:variation/:id
	 * @param {Context} ctx Koa context
	 */
	public async head(ctx: Context) {

		const [file] = await this.find(ctx);
		return this.serve(ctx, file, ctx.params.variation, true);
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

		return FileUtil.create(fileData as File, ctx.req);
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
				FileUtil.create(fileData as File, stream)
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
			logger.warn('[FileApi.handleMultipartUpload] Removing %s', results[0].toShortString());
			await results[0].remove();
			throw err;
		}
		return results[0];
	}

	/**
	 * Retrieves a storage item and does all checks but the quota check.
	 *
	 * @param {Context} ctx Koa context
	 * @returns {Promise<[File, boolean]>} File and true if free
	 */
	private async find(ctx: Context): Promise<[File, boolean]> {

		const file = await state.models.File.findOne({ id: ctx.params.id }).exec();

		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		const variation = file.getVariation(ctx.params.variation);
		const isPublic = file.isPublic(variation);

		// validate variation
		if (ctx.params.variation && !variation) {
			throw new ApiError('No such variation. Valid variations for this file: [ %s ].',
				file.getVariations().map(f => f.name).join(', ')).status(404);
		}

		// conditions for public: cost = -1 and is active.
		if (isPublic) {
			return [file, true];
		}

		// from here on, user must be logged
		if (!ctx.state.user) {
			throw new ApiError('Must be logged when accessing non-public files').status(401);
		}

		// if inactive and not the owner, refuse.
		if (!file.is_active && !file._created_by._id.equals(ctx.state.user._id)) {
			throw new ApiError('You must own inactive files in order to access them.').status(403);
		}

		// now, if it's free, serve it for free
		if (file.isFree(variation) && ctx.state.user) {
			return [file, true];
		}

		// if the user is the owner, serve it for free too.
		if (file._created_by._id.equals(ctx.state.user._id)) {
			return [file, true];
		}
		return [file, false];
	}


	/**
	 * Serves a file to the user.
	 *
	 * For wait-while-processing logic see explanations below.
	 *
	 * @param {Context} ctx Koa context
	 * @param {File} file File to serve
	 * @param {string} variationName Name of the variation to serve
	 * @param {boolean} [headOnly=false] If set, only send the headers but no content (for `HEAD` requests)
	 */
	private async serve(ctx: Context, file: File, variationName: string, headOnly = false) {

		const now = Date.now();

		const variation = file.getVariation(variationName);
		const path = file.getPath(variation);

		let stats: Stats;
		try {
			stats = await statAsync(path);
			// variation creation has already begun but not finished
			/* istanbul ignore if: this is really hard to test because it's a race condition */
			if (stats.size === 0) {
				logger.info('[FileStorage.serve] Waiting for %s to finish', file.toShortString());
				await processorQueue.waitForVariationCreation(file, variation);
				stats = await statAsync(path);
			}
		} catch (err) {
			// statAsync failed, no file at all yet.
			logger.info('[FileStorage.serve] Waiting for %s to start (and finish)', file.toShortString());
			await processorQueue.waitForVariationCreation(file, variation);
			stats = await statAsync(path);
		}

		// Now serve the file!
		// -------------------

		// check if we should return 304 not modified
		const modified = new Date(stats.mtime);
		const ifModifiedSince = ctx.get('if-modified-since') ? new Date(ctx.get('if-modified-since')) : false;
		if (ifModifiedSince && modified.getTime() >= ifModifiedSince.getTime()) {
			return this.success(ctx, null, 304);
		}

		// only return the header if request was HEAD
		if (headOnly) {
			const q = await quota.get(ctx.state.user);
			quota.setHeader(ctx, q);
			return this.success(ctx, null, 200, {
				headers: {
					'Content-Type': file.getMimeType(variation),
					'Content-Length': 0,
					'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
				}
			});
		}

		logger.info('[FileStorage.serve] Started serving %s.', file.toShortString());
		await new Promise((resolve, reject) => {
			// create read stream
			let readStream;
			readStream = createReadStream(path);

			// configure stream
			readStream.on('error', /* istanbul ignore next */ err => {
				logger.error('[FileStorage.serve] Error before streaming %s from storage: %s', file.toShortString(variation), err);
				reject(err);
			});
			readStream.on('close', resolve);

			// set headers
			ctx.set('Content-Type', file.getMimeType(variation));
			ctx.set('Content-Length', String(stats.size));
			ctx.set('Last-Modified', modified.toISOString().replace(/T/, ' ').replace(/\..+/, ''));
			if (ctx.query.save_as) {
				ctx.set('Content-Disposition', 'attachment; filename="' + file.name + '"');
			}

			// start streaming
			ctx.status = 200;
			readStream.pipe(ctx.res)
				.on('error', /* istanbul ignore next */  (err: Error) => {
					logger.error('[FileStorage.serve] Error while streaming %s from storage: %s', file.toShortString(variation), err);
					reject(err);
				});
		});

		logger.verbose('[FileStorage.serve] File %s successfully served to <%s> in %sms.', file.toShortString(variation), ctx.state.user ? ctx.state.user.email : 'anonymous', Date.now() - now);

		// for the file, only count original downloads
		if (!variationName) {
			await file.incrementCounter('downloads');
		}
		// for the user, count all non-free downloads
		if (!file.isFree(variation)) {
			await ctx.state.user.incrementCounter('downloads');
		}
		return true;
	}
}