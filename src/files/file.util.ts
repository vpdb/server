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

import { createWriteStream, stat } from 'fs';
import * as Stream from 'stream';
import Bluebird = require('bluebird');

import { Context } from '../common/types/context';
import { File } from './file';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';

const statAsync = Bluebird.promisify(stat);


export class FileUtil {

	/**
	 * Creates a new file from a HTTP request stream.
	 *
	 * @param {object} fileData Model data
	 * @param {Stream} readStream Binary stream of file content
	 * @param {function} error Error logger
	 * @param {{ [processInBackground]: boolean }} [opts] Options passed to postprocessor
	 * @return {Promise.<FileSchema>}
	 */
	public static async create(ctx: Context, fileData: File, readStream: Stream, opts:any): Promise<File> {

		let file = new ctx.models.File(fileData);
		file = await file.save();

		await new Promise((resolve, reject) => {
			const writeStream = createWriteStream(file.getPath());
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
			readStream.pipe(writeStream);
		});

		// we don't have the file size for multipart uploads before-hand, so get it now
		if (!file.bytes) {
			const stats = await statAsync(file.getPath());
			file.bytes = stats.size;
			await ctx.models.File.update({ _id: file._id }, { bytes: stats.size });
		}

		// FIXME await storage.preprocess(file);

		try {
			// FIXME const metadata = await storage.metadata(file);
			const metadata = {};
			const stats = await statAsync(file.getPath());

			// TODO File.sanitizeObject(metadata);
			file.metadata = metadata;
			file.bytes = stats.size;
			await ctx.models.File.update({ _id: file._id }, { metadata: metadata, bytes: stats.size });

			logger.info('[api|file:save] File upload of %s successfully completed.', file.toString());
			// FIXME return storage.postprocess(file, opts).then(() => file);

		} catch (err) {
			try {
				await file.remove();
			} catch (err) {
				/* istanbul ignore next */
				logger.error('[api|file:save] Error removing file: %s', err.message);
			}
			throw new ApiError(err, 'Metadata parsing failed for type "%s": %s', file.mime_type, err.message).warn().status(400);
		}

		return file;
	}
}
