/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('winston');

var queue = require('./queue');
var quota = require('./quota');
var error = require('./error')('storage');
var settings = require('./settings');
var config = settings.current;

var processors = {
	image: require('./processor/image'),
	video: require('./processor/video'),
	table: require('./processor/table')
};

function Storage() {

	this.variationNames = [];
	var that = this;

	// create necessary paths..
	_.each(this.variations, function(items) {
		_.each(items, function(variations) {
			_.each(variations, function(variation) {
				_.each(['public', 'protected'], function(access) {
					var variationPath = path.resolve(config.vpdb.storage[access].path, variation.name);
					/* istanbul ignore if */
					if (!fs.existsSync(variationPath)) {
						logger.info('[storage] Creating non-existant path for variation "%s" at %s', variation.name, variationPath);
						fs.mkdirSync(variationPath);
					}
					if (!_.contains(that.variationNames, variation.name)) {
						that.variationNames.push(variation.name);
					}
				});
			});
		});
	});

	// setup callback for treatment after post-processing
	queue.on('processed', this.onProcessed);
}

Storage.prototype.variations = {
	image: processors.image.variations,
	video: processors.video.variations,
	table: processors.table.variations
};

/**
 * This is called when we get a request for a storage item that exists in the
 * database but not on the file system.
 * It checks if the item in question is being processed and adds the callback
 * to a queue that is executed when the item has finished processing. If not,
 * the callback is executed immediately.
 *
 * @param {File} file File to check
 * @param {string} variationName Variation of the file
 * @param {function} callback Callback to execute upon processing or error
 */
Storage.prototype.whenProcessed = function(file, variationName, callback) {
	queue.isQueued(file, variationName, function(err, isQueued) {
		/* istanbul ignore if */
		if (err) {
			logger.error('[storage] Error checking for queued file %s: %s', file.toString(variationName), err.message);
			return callback();
		}
		if (!isQueued) {
			logger.error('[storage] No such file being processed: %s', queue.getQueryId(file, variationName));
			return callback();
		}

		queue.addCallback(file, variationName, callback);
	});
};

/**
 * Removes inactive files that have passed the grace period
 *
 * @param {int} graceperiod Grace period in milliseconds
 * @param {function} done Callback
 */
Storage.prototype.cleanup = function(graceperiod, done) {
	graceperiod = graceperiod ? graceperiod : 0;

	var File = require('mongoose').model('File');
	var condition = { is_active: false, created_at: { $lt: new Date(new Date().getTime() - graceperiod)} };
	File.find(condition).populate('_created_by').exec(function(err, files) {
		/* istanbul ignore if */
		if (err) {
			return done(error(err, 'Error getting files for cleanup').log());
		}

		/* istanbul ignore next */
		async.eachSeries(files, function(file, next) {
			logger.info('[storage] Cleanup: Removing inactive file "%s" by <%s> (%s).', file.name, file._created_by ? file._created_by.email : 'unknown', file.id);
			Storage.prototype.remove(file);
			file.remove(next);
		}, done);
	});
};

/**
 * Removes a file and all its variations from storage.
 *
 * In case there are access exceptions, a retry mechanism is in place.
 *
 * @param file
 */
Storage.prototype.remove = function(file) {
	var filePath = file.getPath();
	if (fs.existsSync(filePath)) {
		logger.info('[storage] Removing file %s..', filePath);
		try {
			fs.unlinkSync(filePath);
		} catch (err) {
			/* istanbul ignore next */
			logger.error('[storage] %s', err);

			// if this is a busy problem, try again in a few.
			var retries = 0;
			var intervalId = setInterval(function() {
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
		_.each(this.variations[file.getMimeCategory()][file.file_type], function(variation) {
			filePath = file.getPath(variation.name);
			if (fs.existsSync(filePath)) {
				logger.info('[storage] Removing file variation %s..', filePath);
				try {
					fs.unlinkSync(filePath);
				} catch (err) {
					/* istanbul ignore next */
					logger.error('[storage] Error deleting file (ignoring): %s', err);
				}
			}
		});
	}
};

/**
 * Retrieves metadata for a given file using the processor of the file type.
 * @param {File} file
 * @param {function} done Callback
 */
Storage.prototype.metadata = function(file, done) {
	var type = file.getMimeCategory();
	if (!processors[type]) {
		logger.warn('[storage] No metadata parser for mime category "%s".', type);
		return done();
	}
	processors[type].metadata(file, done);
};

/**
 * Strips the original metadata down to something that is sent to the client
 * via the API.
 *
 * @param {File} file
 * @param {Object} metadata
 * @returns {object} Reduced metadata
 */
Storage.prototype.metadataShort = function(file, metadata) {
	var data = metadata ? metadata : file.metadata;
	var type = file.getMimeCategory();
	if (!data) {
		return {};
	}
	if (!processors[type] || !processors[type].metadataShort) {
		return data;
	}
	return processors[type].metadataShort(data);
};

/**
 * Starts post-processing an uploaded file. See the `queue` module for a
 * complete description of the flow.
 *
 * @param {File} file
 * @param {boolean} [onlyVariations] If set to `true`, only (re-)process variations.
 */
Storage.prototype.postprocess = function(file, onlyVariations) {
	var mimeCategory = file.getMimeCategory();
	if (!processors[mimeCategory]) {
		return;
	}

	// add variations to queue
	if (this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type]) {
		_.each(this.variations[mimeCategory][file.file_type], function(variation) {
			queue.add(file, variation, processors[mimeCategory]);
		});
	}

	// add actual file to queue
	if (!onlyVariations) {
		queue.add(file, undefined, processors[mimeCategory]);
	}
};


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
 * @param {string} nextEvent Which event to call on the queue in order to continue the flow
 */
Storage.prototype.onProcessed = function(file, variation, processor, nextEvent) {

	var originalFile = file;
	var fileId = file.id;
	var File = require('mongoose').model('File');

	async.waterfall([

		/**
		 * Find file, make sure it's still there and move to public storage if necessary.
		 *
		 * @param next Callback
		 */
		function(next) {

			if (!fs.existsSync(file.getPath(variation))) {
				// we don't care here, it's possible that a pass was simply skipped.
				return next(true);
			}

			File.findById(file._id, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					return next(error(err, 'Error fetching file').warn());
				}

				// check that file hasn't been erased meanwhile (hello, tests!)
				if (!file) {
					return next(error('File "%s" gone, has been removed from DB before processing finished.', fileId));
				}

				next(null, file);
			});
		},

		/**
		 * Read metadata from processed file.
		 *
		 * @param file Previously fetched file
		 * @param next Callback
		 */
		function(file, next) {

			// check if file should have been renamed meanwhile
			var dirtyPath = Storage.prototype.path(originalFile, variation);
			var cleanPath = Storage.prototype.path(file, variation);
			if (!fs.existsSync(cleanPath) && fs.existsSync(dirtyPath)) {
				logger.info('[storage] Seems that "%s" was locked while attempting to move, renaming now to "%s".', dirtyPath, cleanPath);
				try {
					fs.renameSync(dirtyPath, cleanPath);
				} catch (err) {
					logger.error('[storage] Error renaming: %s', err.message);
				}
			}

			logger.info('[storage] Reading metadata from %s...', file.toString(variation));

			file.lock(variation);
			processor.metadata(file, variation, function(err, metadata) {
				file.unlock(variation);

				if (err) {
					// it's possible that files were renamed while getting metadata. check and retry.
					if (/no such file/i.test(err.message)) {
						File.findById(file._id, function(err, file) {
							/* istanbul ignore if */
							if (err) {
								return next(error(err, 'Error re-fetching file').warn());
							}
							if (!file) {
								return next(error('File "%s" gone (2), has been removed from DB before processing finished.', fileId));
							}
							logger.info('[storage] Retrying reading metadata from %s...', file.toString(variation));
							processor.metadata(file, variation, function(err, metadata) {
								if (err) {
									logger.error('[storage] Error processing metadata of %s: %s', file.toString(variation), err.message);
									return next(err, file);
								}
								logger.info('[storage] Okay, no error this time for %s, moving on (%s).', file.toString(variation), _.keys(metadata).join(', '));
								next(null, file, metadata);
							});
							// flow through
						});
					} else {
						return next(err, file);
					}

				} else {
					next(null, file, metadata);
				}


			});
		},

		/**
		 * Re-fetch data so we have the freshest varations and keep data loss at a minimum.
		 *
		 * @param file Previously fetched file
		 * @param metadata Previously fetched meta data
		 * @param next Callback
		 */
		function(file, metadata, next) {

			File.findById(file._id, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					return next(error(err, 'Error re-fetching file').warn());
				}

				// check that file hasn't been erased meanwhile (like, in tests..)
				if (!file) {
					return next(error('File "%s" gone, has been removed from DB before metadata finished.', fileId));
				}

				// check if file should have been renamed while reading meta data
				var dirtyPath = Storage.prototype.path(originalFile, variation);
				var cleanPath = Storage.prototype.path(file, variation);
				if (!fs.existsSync(cleanPath) && fs.existsSync(dirtyPath)) {
					logger.info('[storage] Seems that "%s" was locked while attempting to move, renaming now to "%s".', dirtyPath, cleanPath);
					try {
						fs.renameSync(dirtyPath, cleanPath);
					} catch (err) {
						logger.error('[storage] Error renaming: %s', err.message);
					}
				}

				var filepath = file.getPath(variation);
				if (!fs.existsSync(filepath)) {
					// here we care: we came so far, so this was definitely deleted while we were away
					return next(error('File "%s" gone, has been deleted before metadata finished.', filepath), file);
				}

				var data = {};
				if (variation) {

					// save only limited meta data for variations
					var fieldPath = 'variations.' + variation.name;
					data[fieldPath] = _.extend(processor.variationData(metadata), { bytes: fs.statSync(filepath).size });
					if (variation.mimeType) {
						data[fieldPath].mime_type = variation.mimeType;
					}

				} else {

					// save everything, but sanitize first.
					File.sanitizeObject(metadata);
					data.metadata = metadata;
				}

				next(null, file, data);
			});
		},

		/**
		 * Update the database with tidied metadata and moves file to public storage if necessary.
		 *
		 * @param file Previously fetched file
		 * @param data Data to be updated on the file
		 * @param next Callback
		 */
		function(file, data, next) {

			logger.info('[storage] Patching new metadata of %s', file.toString(variation));

			// only update `metadata` (other data might has changed meanwhile)
			File.findByIdAndUpdate(file._id, { $set: data }, { 'new': true }, function(err, cleanFile) {

				if (err || !cleanFile) {
					return next(err, cleanFile);
				}

				// check if file has moved to public storage meanwhile
				var dirtyPath = Storage.prototype.path(originalFile, variation);
				var cleanPath = Storage.prototype.path(cleanFile, variation);
				if (dirtyPath !== cleanPath && fs.existsSync(dirtyPath)) {
					logger.info('[storage] File has moved meanwhile, renaming %s to %s...', dirtyPath, cleanPath);
					try {
						fs.renameSync(dirtyPath, cleanPath);
					} catch (err) {
						logger.error('[storage] Error renaming: %s', err.message);
					}
				}
				next(err, cleanFile);
			});
		}

	], function(err, updatedFile) {

		if (err === true) {
			return logger.warn('[storage] Skipping %s.', file.toString(variation));
		}

		if (err) {
			logger.warn('[storage] Error when writing back metadata to database, aborting post-processing for %s: %s', updatedFile ? updatedFile.toString(variation) : '[null]', err.message);
			return queue.emit('error', err, updatedFile, variation);
		}
		if (updatedFile) {
			queue.emit(nextEvent, updatedFile, variation, processor, true);
		}
	});
};

/**
 * Returns the absolute URL of a given file.
 * @param {File} file
 * @param {object|string} variation or variation name
 * @returns {string}
 */
Storage.prototype.url = function(file, variation) {

	if (!file) {
		return null;
	}
	var storagePath = file.isPublic(variation) ? settings.storagePublicPath.bind(settings) : settings.storageProtectedPath.bind(settings);
	var variationName = _.isObject(variation) ? variation.name : variation;
	return variationName ?
		storagePath('/files/' + variationName + '/' + file.id + file.getExt(variation)) :
		storagePath('/files/' + file.id + file.getExt(variation));
};

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
Storage.prototype.path = function(file, variation, opts) {

	opts = opts || {};
	var baseDir = file.isPublic(variation) && !opts.forceProtected ? config.vpdb.storage.public.path : config.vpdb.storage.protected.path;
	var variationName = _.isObject(variation) ? variation.name : variation;
	var suffix = opts.tmpSuffix || '';
	var ext = opts.lockFile ? '.lock' : file.getExt(variation);
	return variationName ?
		path.resolve(baseDir, variationName, file.id) + suffix + ext :
		path.resolve(baseDir, file.id) + suffix + ext;
};

/**
 * Moves the file or/and the variations to the public storage location.
 *
 * @param {File} file File object to move
 */
Storage.prototype.switchToPublic = function(file) {

	var that = this;
	var mimeCategory = file.getMimeCategory();

	// file
	var protectedPath = that.path(file, null, { forceProtected: true });
	var publicPath = that.path(file);
	if (protectedPath !== publicPath) {
		logger.info('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
		try {
			fs.renameSync(protectedPath, publicPath);
		} catch (err) {
			logger.warn('[storage] Error renaming, re-trying in a second (%s)', err.message);
			setTimeout(function() {
				logger.info('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
				fs.renameSync(protectedPath, publicPath);
			}, 5000);
		}

	} else {
		logger.info('[storage] Skipping renaming of "%s" (no path change)', protectedPath);
	}

	// variations
	if (this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type]) {
		_.each(this.variations[mimeCategory][file.file_type], function(variation) {
			var lockPath = that.path(file, variation, { forceProtected: true, lockFile: true });
			var protectedPath = that.path(file, variation, { forceProtected: true });
			var publicPath = that.path(file, variation);
			if (protectedPath !== publicPath) {
				if (fs.existsSync(protectedPath)) {
					if (!fs.existsSync(lockPath)) {
						try {
							logger.info('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
							fs.renameSync(protectedPath, publicPath);
						} catch (err) {
							logger.warn('[storage] Error renaming, re-trying in a second (%s)', err.message);
							setTimeout(function() {
								logger.info('[storage] Renaming "%s" to "%s"', protectedPath, publicPath);
								fs.renameSync(protectedPath, publicPath);
							}, 5000);
						}
					} else {
						logger.warn('[storage] Skipping rename, "%s" is locked (processing)', protectedPath);
					}
				} else {
					fs.closeSync(fs.openSync(protectedPath, 'w'));
					logger.warn('[storage] Skipping rename, "%s" does not exist (yet).', protectedPath);
				}

			} else {
				logger.info('[storage] Skipping renaming of "%s" (no path change).', protectedPath);
			}
		});
	}
};


/**
 * Enriches a file's variations with the URLs (or creates the `variations` property
 * if non-existent).
 *
 * @param {File} file
 * @returns {object} Keys are the variation name, values are the urls
 */
Storage.prototype.urls = function(file) {
	if (!file) {
		return {};
	}
	var that = this;
	var variations = file.variations || {};
	var mimeCategory = file.getMimeCategory();
	if (this.variations[mimeCategory] && this.variations[mimeCategory][file.file_type]) {
		_.each(this.variations[mimeCategory][file.file_type], function(variation) {
			variations[variation.name] = variations[variation.name] || {};
			variations[variation.name].url = that.url(file, variation);
			var cost = quota.getCost(file, variation);
			if (!file.is_active || cost > -1) {
				variations[variation.name].is_protected = true;
			}
			if (cost > 0) {
				variations[variation.name].cost = cost;
			}
		});
	}
	return variations;
};

Storage.prototype.fstat = function(file, variation, callback) {

	var variationName = _.isObject(variation) ? variation.name : variation;

	if (!variationName) {
		return fs.stat(file.getPath(), callback);
	}

	// check for valid variation name
	if (variationName && !_.contains(this.variationNames, variationName)) {
		logger.warn('[storage] Unknown variation "%s".', variationName);
		return callback();
	}

	queue.isQueued(file, variationName, function(err, isQueued) {
		/* istanbul ignore if */
		if (err) {
			logger.error('[storage] Error checking for queued file %s: %s', file.toString(variationName), err.message);
			return callback();
		}

		if (isQueued) {
			logger.info('[storage] Item %s/%s being processed, returning null.', file.id, variationName);
			return callback();
		}

		// TODO optimize (aka "cache" and make it async, this is called frequently)
		var filePath = file.getPath(variation);
		if (variationName && fs.existsSync(filePath)) {
			return fs.stat(filePath, callback);
		}
		logger.warn('[storage] Cannot find %s at %s', file.toString(variation), filePath);
		callback();
	});
};

module.exports = new Storage();
