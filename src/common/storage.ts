import { promisify } from 'util';
import { close, exists, open, rename, unlink } from 'fs';
import { logger } from './logger';
import { File } from '../files/file';

const existsAsync = promisify(exists);
const unlinkAsync = promisify(unlink);

export class Storage {

	/**
	 * Removes a file and all its variations from storage. On error, a warning
	 * is printed but nothing else done.
	 *
	 * @param file File to remove.
	 */
	async remove(file:File):Promise<void> {
		// original
		await this.removeFile(file.getPath(null, { tmpSuffix: '_original'}), file.toString());

		// processed
		await this.removeFile(file.getPath(), file.toString());

		// variations
		for (let variation of file.getExistingVariations()) {
			await this.removeFile(file.getPath(variation), file.toString(variation));
		}
	}

	/**
	 * Physically removes a file and prints a warning when failed.
	 *
	 * @param {string} path Path to file
	 * @param {string} what What to print
	 */
	async removeFile(path:string, what:string): Promise<void> {
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