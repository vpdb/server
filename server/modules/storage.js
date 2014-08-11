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
var path = require('path');
var async = require('async');
var logger = require('winston');
var ffmpeg = require('fluent-ffmpeg');

var queue = require('./queue');
var config = require('./settings').current;

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
}

Storage.prototype.variations = {
	image: {
		backglass: [
			{ name: 'medium',    width: 364, height: 291 },
			{ name: 'medium-2x', width: 728, height: 582 },
			{ name: 'small',     width: 253, height: 202 },
			{ name: 'small-2x',  width: 506, height: 404 }
		],
		playfield: [
			{ name: 'medium',    width: 393, height: 233 },
			{ name: 'medium-2x', width: 786, height: 466 }
		]
	}
};

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
					/* istanbul ignore next */
					logger.error('[storage] %s', err);
				}
			}
		});
	}
};

Storage.prototype.metadata = function(file, done) {

	switch(file.getMimeType()) {
		case 'image':
			gm(file.getPath()).identify(function(err, metadata) {
				if (err) {
					logger.warn('[storage] Error reading metadata from image: %s', err);
					return done(err);
				}
				done(null, metadata);
			});
			break;
		case 'video':
			ffmpeg.ffprobe(file.getPath(), function(err, metadata) {
				if (err) {
					logger.warn('[storage] Error reading metadata from video (%s): %s', file.getPath(), err);
					return done(err);
				}
				done(null, metadata);
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

Storage.prototype.postprocess = function(file) {
	var type = file.getMimeType();
	var q, processor;
	switch (type) {
		case 'image':
			processor = 'pp-image';
			q = queue.image;
			break;
		case 'video':
			processor = 'pp-video';
			q = queue.video;
			break;
		default:
			return;
	}

	// add variations to queue
	if (this.variations[type] && this.variations[type][file.file_type]) {
		_.each(this.variations[type][file.file_type], function(variation) {
			queue.emit('queued', file, variation);
			q.add({ fileId: file._id, variation: variation }, { processor: processor });
		});
	}

	// add actual file to queue
	queue.emit('queued', file);
	q.add({ fileId: file._id }, { processor: processor });
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

	if (!variationName) {
		return fs.statSync(file.getPath());
	}

	var key = file.id + '/' + variationName;
	if (variationName && !_.contains(this.variationNames, variationName)) {
		return null;
	}

	if (queue.isQueued(file, variationName)) {
		logger.info('[storage] Item %s being processed, returning null', key);
		return null;
	}

	// TODO optimize (aka "cache" and make it async, this is called frequently)
	if (variationName && fs.existsSync(file.getPath(variationName))) {
		return fs.statSync(file.getPath(variationName));
	}
	return null;
};

module.exports = new Storage();