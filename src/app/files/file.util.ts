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

import { createReadStream, createWriteStream, access, mkdir, stat, unlink } from 'fs';
import { dirname, resolve as resolvePath, sep } from 'path';
import * as Stream from 'stream';
import { promisify } from 'util';

import chalk from 'chalk';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { RequestState } from '../common/typings/context';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { FileDocument } from './file.document';
import { Metadata } from './metadata/metadata';
import { processorQueue } from './processor/processor.queue';

const statAsync = promisify(stat);
const mkdirAsync = promisify(mkdir);
const unlinkAsync = promisify(unlink);

export class FileUtil {

	/**
	 * Creates a new file from a HTTP request stream.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} fileData File
	 * @param {Stream} readStream Binary stream of file content
	 * @returns {Promise<FileDocument>}
	 */
	public static async create(requestState: RequestState, fileData: FileDocument, readStream: Stream): Promise<FileDocument> {

		// instantiate file without persisting it yet
		let file = new state.models.File(fileData);
		const path = file.getPath(requestState, null, { tmpSuffix: '_original' });

		// create destination folder if necessary
		if (!(await FileUtil.exists(dirname(path)))) {
			await FileUtil.mkdirp(dirname(path));
		}

		// now stream to disk
		await new Promise((resolve, reject) => {
			const writeStream = createWriteStream(path);
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
			readStream.pipe(writeStream);
		});

		// update file size
		const stats = await statAsync(path);
		file.bytes = stats.size;

		logger.info(requestState, '[FileUtil.create] Saved %s bytes of %s to %s', file.bytes, file.toDetailedString(), path);

		try {
			logger.info(requestState, '[FileUtil.create] Retrieving metadata for %s', file.toDetailedString());
			const metadata = await Metadata.readFrom(requestState, file, path);
			if (metadata) {
				file.metadata = metadata;
				await state.models.File.findByIdAndUpdate(file._id, { metadata }).exec();
			} else {
				logger.warn(requestState, '[FileUtil.create] No metadata reader matched for %s, cannot validate integrity!', file.toDetailedString());
			}

			// here metadata is okay, so let's store it in the database.
			file = await file.save();

		} catch (err) {
			try {
				logger.warn(requestState, '[FileUtil.create] Metadata parsing failed: %s', err.message);
				//await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.error(requestState, '[FileUtil.create] Error removing file at %s: %s', path, err.message);
			}
			try {
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.warn(requestState, '[FileUtil.create] Could not delete file after metadata failed: %s', err.message);
			}
			throw new ApiError('Metadata parsing failed for type "%s": %s', file.mime_type, err.message).log(err).warn().status(400);
		}

		// copy to final destination
		await FileUtil.cp(path, file.getPath(requestState));

		// start processing
		logger.info(requestState, '[FileUtil.create] Adding file %s to processor queue', file.toShortString());
		await processorQueue.processFile(requestState, file, path);

		return file;
	}

	/**
	 * Checks if a file exists. Uses the non-deprecate Node API.
	 * @param path
	 */
	public static async exists(path: string): Promise<boolean> {
		return new Promise<boolean>(resolve => {
			access(path, err => resolve(!err));
		});
	}

	/**
	 * Create a directory recursively.
	 *
	 * @param {string} path Directory to create
	 * @param {{mode?: number}} opts Optional mode
	 * @return {Promise<string>} Absolute path of created directory
	 */
	public static async mkdirp(path: string, opts: { mode?: number } = {}): Promise<string> {
		let mode = opts.mode;
		if (mode === undefined) {
			/* tslint:disable:no-bitwise */
			mode = FileUtil.MODE_0777 & (~process.umask());
		}
		path = resolvePath(path);
		try {
			await mkdirAsync(path, mode);
			return path;

		} catch (err) {
			switch (err.code) {
				case 'ENOENT':
					await FileUtil.mkdirp(dirname(path), opts);
					return FileUtil.mkdirp(path, opts);

				default:
					const st = await statAsync(path);
					if (!st || !st.isDirectory()) {
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
	public static async cp(source: string, target: string): Promise<void> {
		const rd = createReadStream(source);
		const wr = createWriteStream(target);
		return new Promise<void>((resolve, reject) => {
			rd.on('error', reject);
			wr.on('error', reject);
			wr.on('finish', resolve);
			rd.pipe(wr);
		}).catch(/* istanbul ignore next */ error => {
			rd.destroy();
			wr.end();
			throw error;
		});
	}

	/**
	 * Removes inactive files that have passed the grace period
	 *
	 * @param {number} gracePeriod Grace period in milliseconds
	 * @returns {Promise<void>}
	 */
	public static async cleanup(gracePeriod: number = 0): Promise<void> {
		const condition = { is_active: false, created_at: { $lt: new Date(Date.now() - gracePeriod) } };
		const files = await state.models.File.find(condition).populate('_created_by').exec();
		for (const file of files) {
			logger.info(null, '[storage] Cleanup: Removing inactive file "%s" by <%s> (%s).', file.name, file._created_by ? (file._created_by as UserDocument).email : 'unknown', file.id);
			await file.remove();
		}
	}

	/**
	 * Removes a file and all its variations from storage. On error, a warning
	 * is printed but nothing else done.
	 *
	 * @param requestState For logging
	 * @param file File to remove.
	 */
	public static async remove(requestState: RequestState, file: FileDocument): Promise<void> {
		// original
		const originalFile = file.getPath(requestState, null, { tmpSuffix: '_original' });
		await FileUtil.removeFile(requestState, originalFile, file.toShortString());

		// processed
		const processedFile = file.getPath(requestState);
		await FileUtil.removeFile(requestState, processedFile, file.toShortString());

		// variations
		for (const variation of file.getExistingVariations()) {
			const variationFile = file.getPath(requestState, variation);
			await this.removeFile(requestState, variationFile, file.toShortString(variation));
		}
	}

	public static log(path: string): string {
		return path
			.replace(/storage(-test)?-protected/, chalk.gray('priv'))
			.replace(/storage(-test)?-public/, chalk.gray('pub'))
			.split(sep).slice(-3).join('/')
			.replace(/^data\//, '');
	}

	/**
	 * Physically removes a file and prints a warning when failed.
	 *
	 * @param requestState For logging
	 * @param {string} path Path to file
	 * @param {string} what What to print
	 */
	private static async removeFile(requestState: RequestState, path: string, what: string): Promise<void> {
		if (await FileUtil.exists(path)) {
			logger.verbose(requestState, '[FileUtil.removeFile] Removing %s at %s..', what, path);
			try {
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.warn(requestState, '[FileUtil.removeFile] Could not remove %s: %s', what, err.message);
			}
		}
	}

	/* tslint:disable:member-ordering */
	private static MODE_0777 = parseInt('0777', 8);
}
