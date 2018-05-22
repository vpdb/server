import { promisify } from 'util';
import { rename, exists, open, close, unlink } from 'fs';
import { logger } from './logger';
import { File } from '../files/file';

const renameAsync = promisify(rename);
const existsAsync = promisify(exists);
const openAsync = promisify(open);
const closeAsync = promisify(close);
const unlinkAsync = promisify(unlink);

export class Storage {

	/**
	 * Moves the file or/and the variations to the public storage location.
	 *
	 * @param {File} file File object to move
	 */
	public async switchToPublic(file: File):Promise<File> {

		const mimeCategory = file.getMimeCategory();

		// file
		const protectedPath = file.getPath(null, { forceProtected: true });
		const publicPath = file.getPath(file);

		if (protectedPath !== publicPath) {
			logger.verbose('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
			try {
				await renameAsync(protectedPath, publicPath);
			} catch (err) {
				logger.warn('[storage] Error renaming, re-trying in a second (%s)', err.message);
				await new Promise(resolve => setTimeout(resolve, 5000));
				logger.verbose('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
				await renameAsync(protectedPath, publicPath);
			}

		} else {
			logger.verbose('[storage] Skipping renaming of "%s" (no path change)', protectedPath);
		}

		// go through variations
		for (let variation of file.getExistingVariations()) {
			const lockPath = file.getPath(variation, { forceProtected: true });
			const protectedPath = file.getPath(variation, { forceProtected: true });
			const publicPath = file.getPath(variation);
			if (protectedPath !== publicPath) {
				if (await existsAsync(protectedPath)) {
					if (!(await existsAsync(lockPath))) {
						try {
							logger.verbose('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
							await renameAsync(protectedPath, publicPath);
						} catch (err) {
							logger.warn('[storage] Error renaming, re-trying in a second (%s)', err.message);
							await Storage.timeout(5000);
							try {
								logger.verbose('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
								await renameAsync(protectedPath, publicPath);
							} catch (err) {
								logger.warn('[storage] Second time failed too.', err.message);
							}
						}
					} else {
						logger.warn('[storage] Skipping rename, "%s" is locked (processing)', protectedPath);
					}
				} else {
					await closeAsync(await openAsync(protectedPath, 'w'));
					logger.warn('[storage] Skipping rename, "%s" does not exist (yet).', protectedPath);
				}
			} else {
				logger.verbose('[storage] Skipping renaming of "%s" (no path change).', protectedPath);
			}
		}
		return file;
	}

	private static timeout(duration:number):Promise<void> {
		return new Promise<void>(resolve => {
			setTimeout(resolve, duration);
		})
	}

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