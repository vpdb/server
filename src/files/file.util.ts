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

import { createReadStream, createWriteStream, exists, mkdir, stat, unlink } from 'fs';
import { dirname, resolve as resolvePath, sep } from 'path';
import * as Stream from 'stream';
import { promisify } from 'util';

import chalk from 'chalk';
import { ApiError } from '../common/api.error';
import { logger } from '../common/logger';
import { state } from '../state';
import { File } from './file';
import { Metadata } from './metadata/metadata';
import { processorQueue } from './processor/processor.queue';

const statAsync = promisify(stat);
const existsAsync = promisify(exists);
const mkdirAsync = promisify(mkdir);
const unlinkAsync = promisify(unlink);

export class FileUtil {

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

		// update file size
		const stats = await statAsync(path);
		file.bytes = stats.size;

		logger.info('[FileUtil.create] Saved %s bytes of %s to %s', file.bytes, file.toDetailedString(), path);

		try {
			logger.info('[FileUtil.create] Retrieving metadata for %s', file.toDetailedString());
			const metadata = await Metadata.readFrom(file, path);
			if (metadata) {
				file.metadata = metadata;
				await state.models.File.findByIdAndUpdate(file._id, { metadata }).exec();
			} else {
				logger.warn('[FileUtil.create] No metadata reader matched for %s, cannot validate integrity!', file.toDetailedString());
			}

			// here metadata is okay, so let's store it in the database.
			file = await file.save();

		} catch (err) {
			try {
				logger.warn('[FileUtil.create] Metadata parsing failed: %s', err.message);
				//await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.error('[FileUtil.create] Error removing file at %s: %s', path, err.message);
			}
			try {
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.warn('[FileUtil.create] Could not delete file after metadata failed: %s', err.message);
			}
			throw new ApiError('Metadata parsing failed for type "%s": %s', file.mime_type, err.message).log(err).warn().status(400);
		}

		// copy to final destination
		await FileUtil.cp(path, file.getPath());

		// start processing
		logger.info('[FileUtil.create] Adding file %s to processor queue', file.toShortString());
		await processorQueue.processFile(file, path);

		return file;
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
	 * Removes a file and all its variations from storage. On error, a warning
	 * is printed but nothing else done.
	 *
	 * @param file File to remove.
	 */
	public static async remove(file: File): Promise<void> {
		// original
		await FileUtil.removeFile(file.getPath(null, { tmpSuffix: '_original' }), file.toShortString());

		// processed
		await FileUtil.removeFile(file.getPath(), file.toShortString());

		// variations
		for (const variation of file.getExistingVariations()) {
			await this.removeFile(file.getPath(variation), file.toShortString(variation));
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
	 * @param {string} path Path to file
	 * @param {string} what What to print
	 */
	private static async removeFile(path: string, what: string): Promise<void> {
		if (await existsAsync(path)) {
			logger.verbose('[FileUtil.removeFile] Removing %s at %s..', what, path);
			try {
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.warn('[FileUtil.removeFile] Could not remove %s: %s', what, err.message);
			}
		}
	}

	/* tslint:disable:member-ordering */
	private static MODE_0777 = parseInt('0777', 8);
}
