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
var queue = require('bull');
var util  = require('util');
var events = require('events');
var logger = require('winston');

var config = require('./settings').current;

function Queue() {

	events.EventEmitter.call(this);

	var that = this;

	this.queuedFiles = {}; // contains callbacks for potential controller requests of not-yet-processed files

	// have have two queues
	this.image = queue('image transcoding', config.vpdb.redis.port, config.vpdb.redis.host);
	this.video = queue('video transcoding', config.vpdb.redis.port, config.vpdb.redis.host);

	this.image.on('failed', function(job, err) {
		logger.warn('[queue] From image queue: %s', err);
	});

	this.video.on('failed', function(job, err) {
		logger.warn('[queue] From video queue: %s', err);
	});

	var processFile = function(job, done) {

		var opts = JSON.parse(job.opts);
		var processor = require('./processor/' + opts.processor);
		var File = require('mongoose').model('File');
		File.findById(job.data.fileId, function(err, file) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[storage|queue] Error getting file with ID "%s".', job.data.fileId);
				return done();
			}
			if (!file) {
				logger.warn('[storage|queue] File "%s" already gone, aborting.', job.data.fileId);
				return done();
			}
			if (job.data.variation) {
				processor.postprocessVariation(that, file, job.data.variation, done);
			} else {
				processor.postprocess(that, file, done);
			}
		});
	};

	// setup workers
	this.image.process(processFile);
	this.video.process(processFile);

	this.on('queued', function(file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.info('[queue] File %s added to queue.', key);
		that.queuedFiles[key] = [];
	});

	this.on('started', function(file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.info('[queue] File %s started processing.', key);
	});

	this.on('finished', function(file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.info('[queue] File %s finished processing, running %d callback(s).', key, that.queuedFiles[key].length);

		var callbacks = that.queuedFiles[key];
		delete that.queuedFiles[key];
		var storage = require('./storage');
		_.each(callbacks, function(callback) {
			callback(storage.fstat(file, variation.name));
		});
	});
}
util.inherits(Queue, events.EventEmitter);


Queue.prototype.isQueued = function(file, variationName) {
	var key = file.id + '/' + variationName;
	return this.queuedFiles[key] ? true: false;
};

Queue.prototype.addCallback = function(file, variationName, callback) {
	var key = file.id + '/' + variationName;
	this.queuedFiles[key].push(callback);
	logger.info('[queue] Added new callback to %s.', key);
};

Queue.prototype.empty = function() {
	var that = this;
	this.image.count().then(function(count) {
		logger.info('[queue] Cleaning %d entries out of image queue.', count);
		that.image.empty();
	});
	this.video.count().then(function(count) {
		logger.info('[queue] Cleaning %d entries out of video queue.', count);
		that.video.empty();
	});
};

module.exports = new Queue();