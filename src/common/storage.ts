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
import { exists, unlink } from 'fs';
import { logger } from './logger';
import { File } from '../files/file';

const existsAsync = promisify(exists);
const unlinkAsync = promisify(unlink);

/**
 * Storage utils
 * @todo merge with FileUtil?
 */
export class Storage {

	/**
	 * Removes a file and all its variations from storage. On error, a warning
	 * is printed but nothing else done.
	 *
	 * @param file File to remove.
	 */
	async remove(file: File): Promise<void> {
		// original
		await this.removeFile(file.getPath(null, { tmpSuffix: '_original' }), file.toShortString());

		// processed
		await this.removeFile(file.getPath(), file.toShortString());

		// variations
		for (let variation of file.getExistingVariations()) {
			await this.removeFile(file.getPath(variation), file.toShortString(variation));
		}
	}

	/**
	 * Physically removes a file and prints a warning when failed.
	 *
	 * @param {string} path Path to file
	 * @param {string} what What to print
	 */
	async removeFile(path: string, what: string): Promise<void> {
		if (await existsAsync(path)) {
			logger.verbose('[Storage.remove] Removing %s at %s..', what, path);
			try {
				await unlinkAsync(path);
			} catch (err) {
				/* istanbul ignore next */
				logger.warn('[Storage.remove] Could not remove %s: %s', what, err.message);
			}
		}
	}
}

export const storage = new Storage();