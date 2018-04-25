/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const logger = require('winston');

const queue = require('./queue');
const quota = require('../../src/common/quota');
const error = require('./error')('storage');
const settings = require('../../src/common/settings');
const config = settings.current;

const processors = {
	image: require('./processor/image'),
	video: require('./processor/video'),
	table: require('./processor/table'),
	archive: require('./processor/archive'),
	directb2s: require('./processor/directb2s')
};

const stat = Promise.promisify(fs.stat);

class Storage {

	init() {
		this.variationNames = [];
		this.variations = {
			image: processors.image.variations,
			video: processors.video.variations,
			table: processors.table.variations,
			directb2s: processors.directb2s.variations
		};

		// create necessary paths..
		_.each(this.variations, items => {
			_.each(items, variations => {
				variations.forEach(variation => {
					['public', 'protected'].forEach(access => {
						const variationPath = path.resolve(config.vpdb.storage[access].path, variation.name);
						/* istanbul ignore if */
						if (!fs.existsSync(variationPath)) {
							logger.info('[storage] Creating non-existant path for variation "%s" at %s', variation.name, variationPath);
							fs.mkdirSync(variationPath);
						}
						if (!_.includes(this.variationNames, variation.name)) {
							this.variationNames.push(variation.name);
						}
					});
				});
			});
		});

		// setup callback for treatment after post-processing
		queue.on('processed', (file, variation, processor, nextEvent) => {
			return this.onProcessed(file, variation, processor).then(updatedFile => {
				queue.emit(nextEvent, updatedFile, variation, processor, true);

			}).catch(err => {
				logger.warn('[storage] Error when writing back metadata to database, aborting post-processing for %s: %s', file ? file.toString(variation) : '[null]', err.message);
				queue.emit('error', err, null, variation);
			});
		});
	}

	/**
	 * This is called when we get a request for a storage item that exists in the
	 * database but not on the file system.
	 * It checks if the item in question is being processed and adds the callback
	 * to a queue that is executed when the item has finished processing. If not,
	 * the callback is executed immediately.
	 *
	 * @param {File} file File to check
	 * @param {string} variationName Variation of the file
	 * @param {function} callback Function to call when processing is finished
	 * @return {Promise} Resolved when callback is added to Redis
	 */
	whenProcessed(file, variationName, callback) {
		return queue.isQueued(file, variationName).then(isQueued => {
			if (!isQueued) {
				logger.error('[storage] No such file being processed: %s', queue.getQueryId(file, variationName));
				return;
			}
			return queue.addCallback(file, variationName, callback);
		});
	}

	/**
	 * Removes inactive files that have passed the grace period
	 *
	 * @param {int} graceperiod Grace period in milliseconds
	 * @returns {Promise}
	 */
	cleanup(graceperiod) {
		return Promise.try(() => {

			graceperiod = graceperiod ? graceperiod : 0;

			const File = require('mongoose').model('File');
			const condition = { is_active: false, created_at: { $lt: new Date(new Date().getTime() - graceperiod) } };

			return File.find(condition).populate('_created_by').exec();

		}).then(files => {
			return Promise.each(files, file => {
				logger.info('[storage] Cleanup: Removing inactive file "%s" by <%s> (%s).', file.name, file._created_by ? file._created_by.email : 'unknown', file.id);
				this.remove(file);
				return file.remove();
			});
		});
	}


	/**
	 * Retrieves metadata for a given file using the processor of the file type.
	 * @param {File} file
	 * @return {Promise}
	 */
	metadata(file) {
		return Promise.try(function() {
			const type = file.getMimeCategory();
			if (!processors[type]) {
				logger.warn('[storage] No metadata parser for mime category "%s".', type);
				return Promise.resolve();
			}
			return processors[type].metadata(file);
		});
	}

	/**
	 * Strips the original metadata down to something that is sent to the client
	 * via the API.
	 *
	 * @param {File} file File, with metadata included
	 * @param {Object} [metadata] Override metadata
	 * @returns {object} Reduced metadata
	 */
	metadataShort(file, metadata) {
		let data = metadata ? metadata : file.metadata;
		const type = file.getMimeCategory();
		if (!data) {
			return {};
		}
		if (!processors[type] || !processors[type].metadataShort) {
			return data;
		}
		return processors[type].metadataShort(data);
	}

	preprocess(file, done) {
		return Promise.try(() => {
			const type = file.getMimeCategory();
			if (!processors[type] || !processors[type].preprocess) {
				return Promise.resolve(file);
			}
			return processors[type].preprocess(file);

		}).nodeify(done);
	}

	/**
	 * Starts post-processing an uploaded file. See the `queue` module for a
	 * complete description of the flow.
	 *
	 * The logic below is a 2-stop process: First, we mark the file and its
	 * variations as being processed using Queue#initCallback() and resolve
	 * the Promise instantly. Only then the file and variations are added to
	 * the queue.
	 *
	 * @param {File} file
	 * @param {{ [onlyVariations]: boolean, [processInBackground]: boolean }} [opts]
	 * 		- `onlyVariations`: If `true`, only (re-)process variations.
	 * 		- `processInBackground`: If `true`, don't wait for pass 1 to finish.
	 * @returns {Promise} When post process callbacks are initialized.
	 */
	postprocess(file, opts) {
		opts = opts || {};
		const mimeCategory = file.getMimeCategory();
		const processor = processors[mimeCategory];
		const variations = this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type] ?
			this.variations[mimeCategory][file.file_type] :
			null;

		if (!processor) {
			return Promise.resolve();
		}
		return Promise.try(() => {
			// first, init callbacks
			if (!opts.onlyVariations) {
				return queue.initCallback(file);
			}
			return null;

		}).then(() => {
			if (variations) {
				return Promise.all(variations.map(v => queue.initCallback(file, v)));
			}
			return null;

		}).then(() => {

			// if processInBackground is set, just fall through
			if (opts.processInBackground) {
				Promise.each(variations || [], v => queue.start(processor, file, v)).then(() => {
					if (!opts.onlyVariations) {
						queue.start(processor, file);
					}
				});

			} else {
				// queue.start() runs pass 1 and adds it to the queue. this will
				// resolve when all variations have been added to the queue after pass 1.
				return Promise.each(variations || [], v => queue.start(processor, file, v)).then(() => {
					if (!opts.onlyVariations) {
						return queue.start(processor, file);
					}
				});
			}
			return null;
		});
	}


	/**
	 * Gets called when a processor has produced a new version of a file, or a
	 * variation of it. It reads the metadata and updates the file entry in the
	 * database.
	 *
	 * This is executed after each processing pass for each file and variation.
	 *
	 * @param {File} file File that finished processing
	 * @param {object} variation Variation of the file, null if original file
	 * @param {object} processor Processor instance
	 * @returns {Promise.<File>} Promise with updated file
	 */
	onProcessed(file, variation, processor) {

		let originalFile = file;
		let fileId = file.id;
		let File = require('mongoose').model('File');
		let metadata;

		if (!fs.existsSync(file.getPath(variation))) {
			// we don't care here, it's possible that a pass was simply skipped.
			logger.warn('[storage] Skipping %s.', file.toString(variation));
			return Promise.resolve(file);
		}

		return Promise.try(() => {

			// refresh from database
			return File.findById(file._id).exec();

		}).then(file => {

			// check that file hasn't been erased meanwhile (hello, tests!)
			if (!file) {
				throw error('File "%s" gone, has been removed from DB before processing finished.', fileId);
			}

			// check if file should have been moved to public storage meanwhile
			this.checkIfMoved(file, originalFile, variation);

			// read metadata from processed file
			logger.verbose('[storage] Reading metadata from %s...', file.toString(variation));

			file.lock(variation);
			return processor.metadata(file, variation).catch(err => {
				// it's possible that files were renamed while getting metadata. check and retry.
				if (/no such file/i.test(err.message)) {
					return File.findById(file._id).exec().then(file => {
						if (!file) {
							throw error('File "%s" gone (2), has been removed from DB before processing finished.', fileId);
						}
						logger.verbose('[storage] Retrying reading metadata from %s...', file.toString(variation));
						return processor.metadata(file, variation);
					});
				} else {
					throw err;
				}
			}).finally(() => file.unlock(variation));

		}).then(m => {
			metadata = m;

			// re-fetch data so we have the freshest variations and keep data loss at a minimum.
			return File.findById(file._id).exec();

		}).then(file => {

			if (!file) {
				throw error('File "%s" gone, has been removed from DB before metadata finished.', fileId);
			}

			// check if file should have been moved to public storage meanwhile
			this.checkIfMoved(file, originalFile, variation);

			const filepath = file.getPath(variation);
			if (!fs.existsSync(filepath)) {
				// here we care: we came so far, so this was definitely deleted while we were away
				throw error('File "%s" gone, has been deleted before metadata finished.', filepath);
			}

			const data = {};
			if (variation) {
				// save only limited meta data for variations
				const fieldPath = 'variations.' + variation.name;
				data[fieldPath] = _.extend(processor.variationData(metadata), { bytes: fs.statSync(filepath).size });
				if (variation.mimeType) {
					data[fieldPath].mime_type = variation.mimeType;
				}

			} else {
				// save everything, but sanitize first.
				File.sanitizeObject(metadata);
				data.metadata = metadata;
			}

			logger.verbose('[storage] Patching new metadata of %s', file.toString(variation));

			// only update `metadata` (other data might has changed meanwhile)
			return File.findByIdAndUpdate(file._id, { $set: data }, { 'new': true }).exec();

		}).then(updatedFile => {

			if (!updatedFile) {
				throw error('File "%s" gone, has been removed from DB before metadata finished.', fileId);
			}

			// check if file should have been moved to public storage meanwhile
			this.checkIfMoved(file, originalFile, variation);

			return updatedFile;
		});
	}

	/**
	 * Returns the absolute URL of a given file.
	 * @param {File} file
	 * @param {object|string} [variation] variation or variation name, main file if not given
	 * @returns {string|null} URL or null if file is falsy.
	 */
	url(file, variation) {

		if (!file) {
			logger.warn('file is null!');
			return null;
		}
		let storageUri = file.isPublic(variation) ? settings.storagePublicUri.bind(settings) : settings.storageProtectedUri.bind(settings);
		let variationName = _.isObject(variation) ? variation.name : variation;
		return variationName ?
			storageUri('/files/' + variationName + '/' + file.id + file.getExt(variation)) :
			storageUri('/files/' + file.id + file.getExt(variation));
	}

	/**
	 * Returns the absolute local file path of a given file.
	 *
	 * @param {File} file
	 * @param {object|string} [variation] or variation name
	 * @param {object} [opts={}] Optional options.
	 *                              tmpSuffix: a suffix that is added to the file name
	 *                              forceProtected: If true, always return the protected storage location,
	 *                              lockFile: If true, return ".lock" as file extension.
	 * @returns {string} local path to file
	 */
	path(file, variation, opts) {

		opts = opts || {};
		const baseDir = file.isPublic(variation) && !opts.forceProtected ? config.vpdb.storage.public.path : config.vpdb.storage.protected.path;
		const variationName = _.isObject(variation) ? variation.name : variation;
		const suffix = opts.tmpSuffix || '';
		const ext = opts.lockFile ? '.lock' : file.getExt(variation);
		return variationName ?
			path.resolve(baseDir, variationName, file.id) + suffix + ext :
			path.resolve(baseDir, file.id) + suffix + ext;
	}

	/**
	 * Enriches a file's variations with the URLs (or creates the `variations` property
	 * if non-existent).
	 *
	 * @param {File} file
	 * @returns {object} Keys are the variation name, values are the urls
	 */
	urls(file) {
		if (!file) {
			return {};
		}
		const that = this;
		const variations = file.variations || {};
		const mimeCategory = file.getMimeCategory();
		if (this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type]) {
			this.variations[mimeCategory][file.file_type].forEach(variation => {
				variations[variation.name] = variations[variation.name] || {};
				variations[variation.name].url = that.url(file, variation);
				const cost = quota.getCost(file, variation);
				if (!file.is_active || cost > -1) {
					variations[variation.name].is_protected = true;
				}
				if (cost > 0) {
					variations[variation.name].cost = cost;
				}
			});
		}
		return variations;
	}

	/**
	 * Tries to fstat a file and returns null if the file is still being processed or
	 * non existent.
	 *
	 * @param {File} file
	 * @param {string|object} variation
	 * @returns {Promise.<fs.Stats|null>} Stats object or null
	 */
	fstat(file, variation) {

		const variationName = _.isObject(variation) ? variation.name : variation;
		if (!variationName) {
			return stat(file.getPath());
		}

		// check for valid variation name
		if (variationName && !_.includes(this.variationNames, variationName)) {
			logger.warn('[storage] Unknown variation "%s".', variationName);
			return Promise.resolve(null);
		}

		const filePath = file.getPath(variation);
		return queue.isQueued(file, variationName).then(isQueued => {
			if (isQueued) {
				logger.info('[storage] Item %s/%s being processed, returning null.', file.id, variationName);
				return null;
			}
			return stat(filePath).catch(err => {
				logger.warn('[storage] Cannot find %s at %s: %s', file.toString(variation), filePath, err.message);
				return null;
			});

		});
	}

	checkIfMoved(file, originalFile, variation) {

		// check if file should have been renamed while reading meta data
		const dirtyPath = this.path(originalFile, variation);
		const cleanPath = this.path(file, variation);
		if (!fs.existsSync(cleanPath) && fs.existsSync(dirtyPath)) {
			logger.info('[storage] Seems that "%s" was locked while attempting to move, renaming now to "%s".', dirtyPath, cleanPath);
			//try {
			fs.renameSync(dirtyPath, cleanPath);
			//} catch (err) {
			//	logger.error('[storage] Error renaming: %s', err.message);
			//}
		}
	}
}

module.exports = new Storage();