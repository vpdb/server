import { File } from '../files/file.type';
import { rename, exists, open, close, unlink } from 'fs';
import Bluebird = require('bluebird');
import { logger } from './logger';

const renameAsync = Bluebird.promisify(rename);
const existsAsync = Bluebird.promisify(exists);
const openAsync = Bluebird.promisify(open);
const closeAsync = Bluebird.promisify(close);
const unlinkAsync = Bluebird.promisify(unlink);

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

		// variations
		if (this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type]) {
			this.variations[mimeCategory][file.file_type].forEach(function (variation) {
				const lockPath = file.getPath(variation, { forceProtected: true, lockFile: true });
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
								setTimeout(function () {
									try {
										logger.verbose('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
										await renameAsync(protectedPath, publicPath);
									} catch (err) {
										logger.warn('[storage] Second time failed too.', err.message);
									}
								}, 5000);
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
			});
		}
	}

	/**
	 * Removes a file and all its variations from storage.
	 *
	 * In case there are access exceptions, a retry mechanism is in place.
	 *
	 * @param file
	 */
	async remove(file:File):Promise<void> {
		let filePath = file.getPath();
		if (await existsAsync(filePath)) {
			logger.verbose('[storage] Removing file %s..', filePath);
			try {
				await unlinkAsync(filePath);
			} catch (err) {
				/* istanbul ignore next */
				logger.error('[storage] %s', err);

				// if this is a busy problem, try again in a few.
				let retries = 0;
				const intervalId = setInterval(function() {
					if (!fs.existsSync(filePath)) {
						return clearInterval(intervalId);
					}
					if (++retries > 10) {
						logger.error('[storage] Still could not unlink %s, giving up.', filePath);
						return clearInterval(intervalId);
					}
					try {
						fs.unlinkSync(filePath);
						clearInterval(intervalId);
					} catch (err) {
						logger.warn('[storage] Still could not unlink %s (try %d): %s', filePath, retries, err.toString());
					}
				}, 500);
			}
		}
		if (this.variations[file.getMimeCategory()] && this.variations[file.getMimeCategory()][file.file_type]) {
			this.variations[file.getMimeCategory()][file.file_type].forEach(variation => {
				filePath = file.getPath(variation.name);
				if (fs.existsSync(filePath)) {
					logger.verbose('[storage] Removing file variation %s..', filePath);
					try {
						fs.unlinkSync(filePath);
					} catch (err) {
						/* istanbul ignore next */
						logger.error('[storage] Error deleting file (ignoring): %s', err);
					}
				}
			});
		}
	}
}

export const storage = new Storage();