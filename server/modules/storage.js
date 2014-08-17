/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var config = require('./settings').current;

var processors = {
	image: require('./processor/image'),
	video: require('./processor/video')
};

function Storage() {

	this.variationNames = [];
	var that = this;

	// create necessary paths..
	_.each(this.variations, function(items) {
		_.each(items, function(variations) {
			_.each(variations, function(variation) {
				var variationPath = path.resolve(config.vpdb.storage, variation.name);
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

	// setup callback for treatment after post-processing
	queue.on('processed', this.onProcessed);
}

Storage.prototype.variations = {
	image: processors.image.variations,
	video: processors.video.variations
};

/**
 * This is called when we get a request for a storage item that exists in the
 * database but not on the file system.
 * It checks if the item in question is being processed and adds the callback
 * to a queue that is executed when the item has finished processing. If not,
 * the callback is executed immediately.
 *
 * @param file File to check
 * @param variationName Variation of the file
 * @param callback Callback to execute upon processing or error
 * @returns {*}
 */
Storage.prototype.whenProcessed = function(file, variationName, callback) {
	/* istanbul ignore if */
	if (!queue.isQueued(file, variationName)) {
		logger.warn('[storage] No such file being processed: %s', file.id + '/' + variationName);
		return callback(null);
	}
	queue.addCallback(file, variationName, callback);
};

Storage.prototype.cleanup = function(graceperiod, done) {
	graceperiod = graceperiod ? graceperiod : 0;

	var File = require('mongoose').model('File');
	var condition = { is_active: false, created_at: { $lt: new Date(new Date().getTime() - graceperiod)} };
	File.find(condition).populate('_created_by').exec(function(err, files) {
		/* istanbul ignore if */
		if (err) {
			logger.error('[storage] Error getting files for cleanup: %s', err);
			return done(err);
		}

		/* istanbul ignore next */
		async.eachSeries(files, function(file, next) {
			logger.info('[storage] Cleanup: Removing inactive file "%s" by <%s> (%s).', file.name, file._created_by ? file._created_by.email : 'unknown', file.id);
			Storage.prototype.remove(file);
			file.remove(next);
		}, done);
	});
};

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
	if (this.variations[file.getMimeTypePrimary()] && this.variations[file.getMimeTypePrimary()][file.file_type]) {
		_.each(this.variations[file.getMimeTypePrimary()][file.file_type], function(variation) {
			filePath = file.getPath(variation.name);
			if (fs.existsSync(filePath)) {
				logger.info('[storage] Removing file variation %s..', filePath);
				try {
					fs.unlinkSync(filePath);
				} catch (err) {
					/* istanbul ignore next */
					logger.error('[storage] %s', err);
				}
			}
		});
	}
};

/**
 * Metadata callback function
 * @callback metadataCallback
 * @param {Error} If set, an error has occurred
 * @param {object} Metadata
 */
/**
 * Retrieves metadata for a given file using the processor of the file type.
 * @param {File} file
 * @param {metadataCallback} done Callback
 */
Storage.prototype.metadata = function(file, done) {
	var type = file.getMimeTypePrimary();
	if (!processors[type]) {
		logger.warn('[storage] No metadata parser for mime type "%s".', file.mime_type);
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
	var type = file.getMimeTypePrimary();
	if (!data) {
		return {};
	}
	if (!processors[type]) {
		return data;
	}
	return processors[type].metadataShort(data);
};

/**
 * Starts post-processing an uploaded file. See the `queue` module for a
 * complete description of the flow.
 *
 * @param {File} file
 */
Storage.prototype.postprocess = function(file) {
	var type = file.getMimeTypePrimary();
	if (!processors[type]) {
		return;
	}

	// add variations to queue
	if (this.variations[type] && this.variations[type][file.file_type]) {
		_.each(this.variations[type][file.file_type], function(variation) {
			queue.add(file, variation, processors[type]);
		});
	}

	// add actual file to queue
	queue.add(file, undefined, processors[type]);
};


/**
 * Gets called when a processor has produced a new version of a file, or a
 * variation of it. It reads the metadata and updates the file entry in the
 * database.
 *
 * This is executed after each processing pass for each file and variation.
 *
 * @param {File} file - File that finished processing
 * @param {object} variation - Variation of the file, null if original file
 * @param {Object} processor - Processor instance
 * @param {string} nextEvent - Which event to call on the queue in order to continue the flow
 */
Storage.prototype.onProcessed = function(file, variation, processor, nextEvent) {

	var filepath = file.getPath(variation);
	var done = function(err) {
		if (err) {
			logger.warn('[storage] Error when writing back metadata to database, aborting post-processing for %s.', file.toString(variation));
			return queue.emit('error', err, file, variation);
		}
		queue.emit(nextEvent, file, variation, processor);
	};

	if (!fs.existsSync(filepath)) {
		// we don't care here, it's possible that a pass was simply skipped.
		return done();
	}

	// update database with new variation
	processor.metadata(file, variation, function(err, metadata) {
		if (err) {
			return done(err);
		}

		// re-fetch so we're sure no updates are lost
		var fileId = file.id;
		var File = require('mongoose').model('File');
		File.findById(file._id, function(err, file) {
			/* istanbul ignore if */
			if (err) {
				logger.warn('[storage] Error re-fetching file: %s', err);
				return done(err);
			}

			// check that file hasn't been erased meanwhile (hello, tests!)
			if (!file) {
				return done('File "' + fileId + '" gone, has been removed before processing finished.');
			}
			if (!fs.existsSync(filepath)) {
				// here we care: we came so far, so this was definitely deleted while we were away
				return done('File "' + filepath + '" gone, has been deleted before processing finished.');
			}

			// check what we're dealing with
			if (variation) {

				if (!file.variations) {
					file.variations = {};
				}
				file.variations[variation.name] = _.extend(processor.variationData(metadata),  { bytes: fs.statSync(filepath).size });
				if (variation.mimeType) {
					file.variations[variation.name].mime_type = variation.mimeType;
				}
				logger.info('[storage] Updating %s "%s" with variation %s.', file.file_type, file.id, variation.name);

			} else {
				File.sanitizeObject(metadata);
				file.metadata = metadata;
				logger.info('[storage] Updating metadata of %s "%s"', file.file_type, file.id);
			}

			// change to file.save when fixed: https://github.com/LearnBoost/mongoose/issues/1694
			File.findOneAndUpdate({ _id: file._id }, _.omit(file.toJSON(), [ '_id', '__v' ]), {}, done);
		});
	});
};

/**
 * Returns the absolute URL of a given file.
 * @param {File} file
 * @param {object} variation
 * @returns {string}
 */
Storage.prototype.url = function(file, variation) {
	return file ? '/storage/' + file.id + (variation ? '/' + variation : '') : null;
};

/**
 * Returns URLs of all variations of a given file.
 * @param {File} file
 * @returns {object} Keys are the variation name, values are the urls
 */
Storage.prototype.urls = function(file) {
	if (!file) {
		return {};
	}
	var that = this;
	var variations = file.variations ? file.variations : {};
	if (this.variations[file.getMimeTypePrimary()] && this.variations[file.getMimeTypePrimary()][file.file_type]) {
		_.each(this.variations[file.getMimeTypePrimary()][file.file_type], function(variation) {
			if (!variations[variation.name]) {
				variations[variation.name] = {};
			}
			variations[variation.name].url = that.url(file, variation.name);
		});
	}
	return variations;
};

Storage.prototype.fstat = function(file, variationName) {

	if (!variationName) {
		return fs.statSync(file.getPath());
	}

	// check for valid variation name
	if (variationName && !_.contains(this.variationNames, variationName)) {
		logger.warn('[storage] Unknown variation "%s".', variationName);
		return null;
	}

	if (queue.isQueued(file, variationName)) {
		logger.info('[storage] Item %s/%s being processed, returning null', file.id, variationName);
		return null;
	}

	// TODO optimize (aka "cache" and make it async, this is called frequently)
	if (variationName && fs.existsSync(file.getPath(variationName))) {
		return fs.statSync(file.getPath(variationName));
	}
	logger.warn('[storage] Cannot find %s at %s', file.toString(variationName), file.getPath(variationName));
	return null;
};

module.exports = new Storage();
