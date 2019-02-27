/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import Busboy from 'busboy';
import { createReadStream } from 'fs';

import { Api } from '../common/api';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { quota } from '../common/quota';
import { Context } from '../common/typings/context';
import { LogEventUtil } from '../log-event/log.event.util';
import { state } from '../state';
import { FileDocument } from './file.document';
import { fileTypes } from './file.types';
import { FileUtil } from './file.util';
import { processorQueue } from './processor/processor.queue';

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

		// fail if no file type
		if (!ctx.query.type) {
			throw new ApiError('Query parameter "type" must be provided.').status(422);
		}
		// fail if unknown file type
		if (!fileTypes.names.includes(ctx.query.type)) {
			throw new ApiError('Unknown "type" parameter. Known values are: [ %s ].', fileTypes.names.join(', ')).status(422);
		}
		// fail if no content type
		if (!ctx.get('content-type')) {
			throw new ApiError('Header "Content-Type" must be provided.').status(422);
		}

		// stream either directly from req or use a multipart parser
		let file: FileDocument;
		if (/multipart\/form-data/i.test(ctx.get('content-type'))) {
			file = await this.handleMultipartUpload(ctx);
		} else {
			file = await this.handleRawUpload(ctx);
		}
		this.success(ctx, state.serializers.File.detailed(ctx, file), 201);
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

		const [file, isFree, isPublic] = await this.find(ctx);

		let startedMs: number;
		if (isFree) {
			startedMs = Date.now();
			await this.serve(ctx, file, ctx.params.variation);

		} else {
			// check the quota
			await quota.assert(ctx, file);

			// we're here, so serve!
			startedMs = Date.now();
			await this.serve(ctx, file, ctx.params.variation);
		}
		const timeMs = Date.now() - startedMs;

		if (!isPublic) {
			this.noAwait(async () => {
				await LogEventUtil.log(ctx, 'download_file', false, {
					response: {
						bytes_sent: file.bytes,
						time_ms: timeMs,
					},
				}, {
					file: file._id,
				});
			});
		}
	}

	/**
	 * Checks if a file exists.
	 *
	 * @see HEAD /v1/files/:id
	 * @see HEAD /v1/files/:variation/:id
	 * @see HEAD /files/:id
	 * @see HEAD /files/:variation/:id
	 * @param {Context} ctx Koa context
	 */
	public async head(ctx: Context) {

		const [file] = await this.find(ctx);
		return this.serve(ctx, file, ctx.params.variation, true);
	}

	/**
	 * Handles uploaded data posted as-is with a content type
	 * Correct file type is already asserted.
	 * @param {Context} ctx Koa context
	 * @return {Promise<FileDocument>}
	 */
	private async handleRawUpload(ctx: Context): Promise<FileDocument> {

		// fail if wrong content type
		if (!fileTypes.getMimeTypes(ctx.query.type).includes(ctx.get('content-type'))) {
			throw new ApiError('Invalid "Content-Type" header. Valid headers for type "%s" are: [ %s ].', ctx.query.type, fileTypes.getMimeTypes(ctx.query.type).join(', ')).status(422);
		}

		// fail if no Content-Disposition header
		if (!ctx.get('content-disposition')) {
			throw new ApiError('Header "Content-Disposition" must be provided.').status(422);
		}

		// fail if invalid Content-Disposition header
		if (!/filename=([^;]+)/i.test(ctx.get('content-disposition'))) {
			throw new ApiError('Header "Content-Disposition" must contain file name.').status(422);
		}
		const filename = ctx.get('content-disposition').match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, '');

		// create file
		logger.info(ctx.state, '[FileStorage.handleRawUpload] Starting file upload of "%s"...', filename);
		const fileData = {
			name: filename,
			bytes: ctx.get('content-length') || 0,
			variations: {},
			created_at: new Date(),
			mime_type: ctx.get('content-type'),
			file_type: ctx.query.type,
			_created_by: ctx.state.user._id,
		};

		return FileUtil.create(ctx.state, fileData as FileDocument, ctx.req);
	}

	/**
	 * Handles uploaded data posted as multipart.
	 * Correct file type is already asserted.
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise<FileDocument>}
	 */
	private async handleMultipartUpload(ctx: Context): Promise<FileDocument> {

		// fail if no content type
		if (!ctx.query.content_type) {
			throw new ApiError('Mime type must be provided as query parameter "content_type" when using multipart.').status(422);
		}

		// fail if wrong content type
		if (!fileTypes.getMimeTypes(ctx.query.type).includes(ctx.query.content_type)) {
			throw new ApiError('Invalid "Content-Type" parameter. Valid parameter for type "%s" are: [ %s ].', ctx.query.type, fileTypes.getMimeTypes(ctx.query.type).join(', ')).status(422);
		}

		return new Promise<FileDocument>((resolve, reject) => {
			let numFiles = 0;
			let internalErr: ApiError;
			let file: FileDocument;
			let finished = false;
			const busboy = new Busboy({ headers: ctx.request.headers });
			busboy.on('file', (fieldname, stream, filename) => {
				numFiles++;
				if (numFiles > 1) {
					internalErr = new ApiError('Multipart requests must only contain one file.').code('too_many_files').status(422);
					stream.resume();
					return;
				}
				logger.info(ctx.state, '[FileStorage.handleMultipartUpload] Starting file (multipart) upload of "%s"', filename);
				const fileData = {
					name: filename,
					bytes: 0,
					variations: {},
					created_at: new Date(),
					mime_type: ctx.query.content_type,
					file_type: ctx.query.type,
					_created_by: ctx.state.user._id,
				};
				FileUtil.create(ctx.state, fileData as FileDocument, stream)
					.then(f => {
						if (finished) {
							return resolve(f);
						}
						file = f;
					})
					.catch(e => {
						if (finished) {
							return reject(e);
						}
						internalErr = e;
					});
			});
			busboy.on('error', (busboyErr: any) => {
				logger.warn(ctx.state, '[FileApi.handleMultipartUpload] Error: %s', busboyErr);
				reject(busboyErr);
			});
			busboy.on('finish', () => {
				if (internalErr) {
					if (file) {
						logger.warn(ctx.state, '[FileApi.handleMultipartUpload] Removing %s', file.toShortString());
						file.remove().then(() => reject(internalErr));
					} else {
						return reject(internalErr);
					}
				}
				if (file) {
					return resolve(file);
				}
				finished = true;
			});
			ctx.req.pipe(busboy);
		});
	}

	/**
	 * Retrieves a storage item and does all checks but the quota check.
	 *
	 * @param {Context} ctx Koa context
	 * @returns {Promise<[FileDocument, boolean, boolean]>} File and true if free, true if public
	 */
	private async find(ctx: Context): Promise<[FileDocument, boolean, boolean]> {

		const file = await state.models.File.findOne({ id: ctx.params.id }).exec();
		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		const variation = file.getVariation(ctx.params.variation);
		const isPublic = file.isPublic(ctx.state, variation);

		// validate variation
		if (ctx.params.variation && !variation) {
			throw new ApiError('No such variation. Valid variations for this file: [ %s ].',
				file.getVariations().map(f => f.name).join(', ')).status(404);
		}

		// conditions for public: cost == -1 && is_active.
		if (isPublic) {
			return [file, true, isPublic];
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
		if (file.isFree(ctx.state, variation) && ctx.state.user) {
			return [file, true, isPublic];
		}

		// if the user is the owner, serve it for free too.
		if (file._created_by._id.equals(ctx.state.user._id)) {
			return [file, true, isPublic];
		}

		// otherwise, it's not free.
		return [file, false, isPublic];
	}

	/**
	 * Serves a file to the user.
	 *
	 * For wait-while-processing logic see explanations below.
	 *
	 * @param {Context} ctx Koa context
	 * @param {FileDocument} file File to serve
	 * @param {string} variationName Name of the variation to serve
	 * @param {boolean} [headOnly=false] If set, only send the headers but no content (for `HEAD` requests)
	 */
	private async serve(ctx: Context, file: FileDocument, variationName: string, headOnly = false) {

		const now = Date.now();

		const variation = file.getVariation(variationName);
		const path = file.getPath(ctx.state, variation);
		const stats = await processorQueue.stats(ctx.state, file, variation);

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
			const q = await quota.get(ctx.state, ctx.state.user);
			quota.setHeader(ctx, q);
			return this.success(ctx, null, 200, {
				headers: {
					'Content-Type': file.getMimeType(variation),
					'Content-Length': 0,
					'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
				},
			});
		}

		// for the file, only count original downloads
		if (!variationName) {
			await file.incrementCounter('downloads');
			if (file.isTableFile()) {
				const release = await file.getVersionFile();
				if (release) {
					for (const version of release.versions) {
						for (const versionFile of version.files) {
							if (versionFile._file.equals(file._id)) {
								await versionFile.incrementCounter('downloads');
								await version.incrementCounter('downloads');
								await release.incrementCounter('downloads');
							}
						}
					}
				}
			}
		}

		logger.info(ctx.state, '[FileStorage.serve] Started serving %s.', file.toShortString());
		await new Promise((resolve, reject) => {

			// create read stream
			let readStream;
			readStream = createReadStream(path);

			// configure stream
			readStream.on('error', /* istanbul ignore next */ err => {
				logger.error(ctx.state, '[FileStorage.serve] Error before streaming %s from storage: %s', file.toShortString(variation), err);
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
					logger.error(ctx.state, '[FileStorage.serve] Error while streaming %s from storage: %s', file.toShortString(variation), err);
					reject(err);
				});
		});

		logger.verbose(ctx.state, '[FileStorage.serve] File %s successfully served to <%s> in %sms.', file.toShortString(variation), ctx.state.user ? ctx.state.user.email : 'anonymous', Date.now() - now);

		// for the user, count all non-free downloads
		if (!file.isFree(ctx.state, variation)) {
			await ctx.state.user.incrementCounter('downloads');
		}
	}
}
