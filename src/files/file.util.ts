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

import { promisify } from 'util';
import { dirname, resolve } from 'path';
import { createReadStream, createWriteStream, exists, mkdir, stat, unlink } from 'fs';
import * as Stream from 'stream';

import { state } from '../state';
import { File } from './file';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { Metadata } from './metadata/metadata';
import { processorQueue } from './processor/processor.queue';

const statAsync = promisify(stat);
const existsAsync = promisify(exists);
const mkdirAsync = promisify(mkdir);
const unlinkAsync = promisify(unlink);

export class FileUtil {

	private static MODE_0777 = parseInt('0777', 8);

	/**
	 * Creates a new file from a HTTP request stream.
	 *
	 * @param {File} fileData File
	 * @param {Stream} readStream Binary stream of file content
	 * @returns {Promise<File>}
	 */
	public static async create(fileData: File, readStream: Stream): Promise<File> {

		// instantiate file without persisting it yet
		let file = new state.models.File(fileData);
		const path = file.getPath(null, { tmpSuffix: '_original' });

		// create destination folder if necessary
		if (!(await existsAsync(dirname(path)))) {
			await FileUtil.mkdirp(dirname(path));
		}

		// now stream to disk
		await new Promise((resolve, reject) => {
			const writeStream = createWriteStream(path);
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
			readStream.pipe(writeStream);
		});
		logger.info('[FileUtil.create] Saved %s to %s', file.toDetailedString(), path);

		// update file size
		const stats = await statAsync(path);
		file.bytes = stats.size;

		try {

			logger.info('[FileUtil.create] Retrieving metadata for %s', file.toDetailedString());
			const metadata = await Metadata.readFrom(file, path);
			if (metadata) {
				file.metadata = metadata;
				await state.models.File.findByIdAndUpdate(file._id, { metadata: metadata }).exec();
			} else {
				logger.warn('[FileUtil.create] No metadata reader matched for %s, cannot validate integrity!', file.toDetailedString());
			}

			// here metadata is okay, so let's store it in the database.
			file = await file.save();

		} catch (err) {
			try {
				logger.warn('[FileUtil.create] Metadata parsing failed: %s', err.message);
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.error('[FileUtil.create] Error removing file at %s: %s', path, err.message);
			}
			throw new ApiError('Metadata parsing failed for type "%s": %s', file.mime_type, err.message).log(err).warn().status(400);
		}

		// copy to final destination
		await FileUtil.cp(path, file.getPath());

		// start processing
		await processorQueue.processFile(file);
		logger.info('[FileUtil.create] File %s to processor queue.', file.toShortString());

		return file;
	}

	/**
	 * Create a directory recursively.
	 *
	 * @param {string} path Directory to create
	 * @param {{mode?: number}} opts Optional mode
	 * @return {Promise<string>} Absolute path of created directory
	 */
	static async mkdirp(path: string, opts: { mode?: number } = {}): Promise<string> {
		let mode = opts.mode;
		if (mode === undefined) {
			mode = FileUtil.MODE_0777 & (~process.umask());
		}
		path = resolve(path);
		try {
			await mkdirAsync(path, mode);
			return path;

		} catch (err) {
			switch (err.code) {
				case 'ENOENT':
					await FileUtil.mkdirp(dirname(path), opts);
					return await FileUtil.mkdirp(path, opts);

				default:
					const stat = await statAsync(path);
					if (!stat || !stat.isDirectory()) {
						throw err;
					}
					break;
			}
		}
	}

	/**
	 * Copies a file.
	 * @param {string} source Source
	 * @param {string} target Destination
	 */
	static async cp(source:string, target:string): Promise<void> {
		const rd = createReadStream(source);
		const wr = createWriteStream(target);
		return new Promise<void>(function(resolve, reject) {
			rd.on('error', reject);
			wr.on('error', reject);
			wr.on('finish', resolve);
			rd.pipe(wr);
		}).catch(function(error) {
			rd.destroy();
			wr.end();
			throw error;
		});
	}
}
