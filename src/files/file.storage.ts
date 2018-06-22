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

import { state } from '../state';
import { Api } from '../common/api';
import { Context } from '../common/types/context';
import { quota } from '../common/quota';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { File } from './file';
import { processorQueue } from './processor/processor.queue';

const statAsync = promisify(stat);

export class FileStorage extends Api {

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
		const granted = await quota.isAllowed(ctx, file);
		if (!granted) {
			throw new ApiError('No more quota left.').status(403).warn();
		}
		return this.serve(ctx, file, ctx.params.variation);

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
	 * Retrieves a storage item and does all checks but the quota check.
	 *
	 * @param {Context} ctx Koa context
	 * @returns {Promise<[File, boolean]>} File and true if public
	 */
	private async find(ctx: Context): Promise<[File, boolean]> {

		const file = await state.models.File.findOne({ id: ctx.params.id }).exec();

		if (!file) {
			throw new ApiError('No such file with ID "%s".', ctx.params.id).status(404);
		}

		const variation = file.getVariation(ctx.params.variation);
		const isPublic = file.isPublic(variation);

		// if inactive and user is not logged or not the owner, refuse.
		if (!file.is_active) {
			if (!ctx.state.user) {
				throw new ApiError('You must provide credentials for inactive files.').log(ctx.state.authError).status(401);
			}
			if (!file._created_by._id.equals(ctx.state.user._id)) {
				throw new ApiError('You must own inactive files in order to access them.').status(403);
			}
		}

		// at this point, we can serve the file if it's free
		if (isPublic) {
			return [file, isPublic];
		}

		// we also serve it if it's free and the user is logged
		if (file.isFree(variation) && ctx.state.user) {
			return [file, isPublic];
		}

		// if the user is the owner, serve directly (owned files don't count as credits)
		if ((file._created_by as any).equals(ctx.state.user._id)) {
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

		// validate variation
		const variation = file.getVariation(variationName);
		if (variationName && !variation) {
			throw new ApiError('No such variation. Valid variations for this file: [ %s ].',
				file.getVariations().map(f => f.name).join(', ')).status(404);
		}
		const path = file.getPath(variation);

		let stats: Stats;
		try {
			stats = await statAsync(path);
			if (stats.size === 0) {
				await processorQueue.waitForVariationCreation(file, variation);
				stats = await statAsync(path);
			}
		} catch (err) {
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
			const q = await quota.getCurrent(ctx.state.user);
			quota.setHeader(ctx, q.limit, q.remaining, q.reset, q.unlimited);
			return this.success(ctx, null, 200, {
				headers: {
					'Content-Type': file.getMimeType(variation),
					'Content-Length': 0,
					'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
				}
			});
		}

		await new Promise((resolve, reject) => {
			// create read stream
			let readStream;
			// if (file.isLocked()) {
			// 	logger.warn('[FileStorage.serve] File is being processed, loading file into memory in order to free up file handle rapidly (%s).', file.getPath());
			// 	readStream = new BufferStream(fs.readFileSync(filePath));
			// } else {
			readStream = createReadStream(path);
			//}

			// configure stream
			readStream.on('error', err => {
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
				.on('error', (err: Error) => {
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