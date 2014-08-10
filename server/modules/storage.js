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

var _ = require('underscore');
var gm = require('gm');
var fs = require('fs');
var util  = require('util');
var path = require('path');
var async = require('async');
var logger = require('winston');
var events = require('events');

var config = require('./settings').current;

function Storage() {

	events.EventEmitter.call(this);
	this.variationNames = [];
	this.processingFiles = {}; // contains callbacks for potential controller requests of not-yet-processed files

	var that = this;

	// create necessary paths..
	_.each(this.variations, function(items) {
		_.each(items, function(variations) {
			_.each(variations, function(variation) {
				var variationPath = path.resolve(config.vpdb.storage, variation.name);
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

	// collect processing files
	this.on('postProcessStarted', function(file, variation) {
		var key = file.id + '/' + variation.name;
		logger.info('[storage] Post-processing of %s started.', key);
		that.processingFiles[key] = [];
	});

	this.on('postProcessFinished', function(file, variation) {
		var key = file.id + '/' + variation.name;
		logger.info('[storage] Post-processing of %s done, running %d callback(s).', key, that.processingFiles[key].length);

		var callbacks = that.processingFiles[key];
		delete that.processingFiles[key];
		_.each(callbacks, function(callback) {
			callback(that.fstat(file, variation.name));
		});
	});
}
util.inherits(Storage, events.EventEmitter);

Storage.prototype.variations = {
	image: {
		backglass: [
			{ name: 'medium',    width: 364, height: 291 },
			{ name: 'medium-2x', width: 728, height: 582 },
			{ name: 'small',     width: 253, height: 202 },
			{ name: 'small-2x',  width: 506, height: 404 }
		]
	}
};

Storage.prototype.whenProcessed = function(file, variationName, callback) {
	var key = file.id + '/' + variationName;
	if (!this.processingFiles[key]) {
		logger.warn('[storage] No such file being processed: %s', key);
		return callback(null);
	}
	logger.info('[storage] Added %s to queue for post-post-processing.', key);
	this.processingFiles[key].push(callback);
};


Storage.prototype.cleanup = function(graceperiod, done) {
	graceperiod = graceperiod ? graceperiod : 0;

	var File = require('mongoose').model('File');
	File.find({ is_active: false, created_at: { $lt: new Date(new Date().getTime() - graceperiod)} })
		.populate('_created_by').
		exec(function(err, files) {
		if (err) {
			logger.error('[storage] Error getting files for cleanup: %s', err);
			return done(err);
		}

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
			logger.error('[storage] %s', err);
		}
	}
	if (this.variations[file.getMimeType()] && this.variations[file.getMimeType()][file.file_type]) {
		_.each(this.variations[file.getMimeType()][file.file_type], function(variation) {
			filePath = file.getPath(variation.name);
			if (fs.existsSync(filePath)) {
				logger.info('[storage] Removing file variation %s..', filePath);
				try {
					fs.unlinkSync(filePath);
				} catch (err) {
					logger.error('[storage] %s', err);
				}
			}
		});
	}
};

Storage.prototype.metadata = function(file, done) {

	switch(file.getMimeType()) {
		case 'image':
			gm(file.getPath()).identify(function(err, value) {
				if (err) {
					logger.warn('[storage] Error reading metadata from image: %s', err);
					return done(err);
				}
				done(null, value);
			});
			break;
		default:
			logger.warn('[storage] No metadata parser for mime type "%s".', file.mime_type);
			done();
	}
};

Storage.prototype.metadataShort = function(file, metadata) {

	var data = metadata ? metadata : file.metadata;
	if (!data) {
		return {};
	}
	switch(file.getMimeType()) {
		case 'image':
			return _.pick(data, 'format', 'size', 'depth', 'JPEG-Quality');
		default:
			return data;
	}
};

Storage.prototype.postprocess = function(file, done) {
	done = done || function() {};
	var type = file.getMimeType();
	var that = this;

	var postprocessor;
	switch(type) {
		case 'image':
			postprocessor = require('./storage/pp-image');
			break;
		default:
			postprocessor = null;
	}
	if (!postprocessor) {
		return done();
	}
	var tasks = [];

	// prepare variation processing
	if (this.variations[type][file.file_type]) {
		_.each(this.variations[type][file.file_type], function(variation) {
			tasks.push(function(next) {
				postprocessor.postprocessVariation(that, file, variation, next);
			});
		});
	}

	// add actual file processing
	tasks.push(function(next) {
		postprocessor.postprocess(that, file, next);
	});

	// go!
	async.parallel(tasks, done);
};

/**
 * Returns the absolute URL of a given file.
 * @param file
 * @param variation
 * @returns {string}
 */
Storage.prototype.url = function(file, variation) {
	return file ? '/storage/' + file.id + (variation ? '/' + variation : '') : null;
};

/**
 * Returns URLs of all variations of a given file.
 * @param file
 * @returns {object} Keys are the variation name, values are the urls
 */
Storage.prototype.urls = function(file) {
	if (!file) {
		return {};
	}
	var that = this;
	var variations = file.variations ? file.variations : {};
	if (this.variations[file.getMimeType()] && this.variations[file.getMimeType()][file.file_type]) {
		_.each(this.variations[file.getMimeType()][file.file_type], function(variation) {
			if (!variations[variation.name]) {
				variations[variation.name] = {};
			}
			variations[variation.name].url = that.url(file, variation.name);
		});
	}
	return variations;
};

Storage.prototype.fstat = function(file, variationName) {

	var key = file.id + '/' + variationName;
	if (variationName && !_.contains(this.variationNames, variationName)) {
		return null;
	}
	if (this.processingFiles[key]) {
		logger.info('[storage] Item %s being processed, returning null', key);
		return null;
	}

	// TODO optimize (aka "cache" and make it async, this is called frequently)
	if (variationName && fs.existsSync(file.getPath(variationName))) {
		return fs.statSync(file.getPath(variationName));

	// fallback to non-variation.
	} else if (fs.existsSync(file.getPath())) {
		return fs.statSync(file.getPath());
	}
	return null;
};

module.exports = new Storage();