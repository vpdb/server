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

/**
 * The processing queue. This is used for post-processing uploaded files and is executed asynchronously after the
 * response has already been returned to the client.
 *
 * A processing module can implement two processing passes.
 *
 * - PASS 1 is spawned instantly and processed in parallel. It is only executed for variations, since the goal
 *   of pass 1 is to obtain a new variation as soon as possible (for images, that would be the resizing).
 *   If this pass is implemented, the callbacks of waiting requests will be executed after completion.
 * - PASS 2 is added to the message queue and processed one after another. The goal of pass 2 is to further optimize
 *   the file, which could be processor-intensive (for images, that would be the PNG crunching). If pass 1 is not
 *   implemented, the callbacks of waiting requests will be executed after this pass.
 *
 * Lifecycle:
 *
 * 1. A new file was uploaded and Queue##add is called.
 * 2. A job is added to the Bull queue that contains the file id, variation if set and the processor name.
 * 3. At some point, the processFile method below gets called. It:
 *    - Fetches the file object from the DB using the file id
 *    - Instantiates the processor using the name
 *    - Executes the processor with the file
 * 4. The processor does its thing and emits the "processed" event.
 * 5. The storage module, which is subscribed to the "processed" event finishes the processing by
 *    - retrieving meta-data of the new file
 *    - updating the "variations" field of the file
 *    - saving the file to the DB
 * 6. The storage module emits the "finished" event on the queue module.
 * 7. The queue module checks for eventual callbacks and calls them if necessary, otherwise concludes the life cycle.
 *
 * @constructor
 */
function Queue() {

	events.EventEmitter.call(this);

	var that = this;

	this.queuedFiles = {}; // contains callbacks for potential controller requests of not-yet-processed files

	// have have two queues
	this.queues = {
		image: queue('image transcoding', config.vpdb.redis.port, config.vpdb.redis.host),
		video: queue('video transcoding', config.vpdb.redis.port, config.vpdb.redis.host)
	};

	this.queues.image.on('failed', function(job, err) {
		logger.warn('[queue] From image queue: %s', err);
	});

	this.queues.video.on('failed', function(job, err) {
		logger.warn('[queue] From video queue: %s', err);
	});

	/**
	 * Unserializes file ID into file and processor name into processor
	 * instance and starts processing.
	 *
	 * @param job
	 * @param done
	 */
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
			var variation = job.data.variation;
			processor.pass2(file, variation, function(err) {
				if (err) {
					that.emit('error', err, file, variation);
					return done(err);
				}
				logger.info('[queue] Pass 2 done for %s "%s" (%s).', file.file_type, file.id, variation ? variation.name : 'original');
				that.emit('processed', file, variation, opts.processor, 'finishedPass2');
				done();
			});

		});
	};

	/**
	 * Processes callback queue
	 */
	var processQueue = function(file, variation, storage) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		if (!that.queuedFiles[key]) {
			return;
		}
		var callbacks = that.queuedFiles[key];
		delete that.queuedFiles[key];
		_.each(callbacks, function(callback) {
			callback(storage ? storage.fstat(file, variation.name) : null);
		});
	};

	// setup workers
	this.queues.image.process(processFile);
	this.queues.video.process(processFile);

	this.on('started', function(file, variation, processorName) {
		if (variation) {
			logger.info('[queue] Starting %s processing of "%s" variation "%s"...', processorName, file.id, variation.name);
		} else {
			logger.info('[queue] Starting %s processing of "%s"...', processorName, file.id);
		}
	});

	this.on('finishedPass1', function(file, variation, processorName) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		var processor = require('./processor/' + processorName);
		// run pass 2
		if (processor.pass2) {
			this.queues[processorName].add({ fileId: file._id, variation: variation }, { processor: processorName });
			logger.info('[queue] Pass 1 done (or skipped), adding %s "%s" (%s) to queue (%d callbacks).', file.file_type, file.id, variation ? variation.name : 'original', that.queuedFiles[key] ? that.queuedFiles[key].length : 0);
		}
		processQueue(file, variation, require('./storage'));
	});

	this.on('finishedPass2', function(file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.info('[queue] File %s finished processing, running %d callback(s).', key, that.queuedFiles[key] ? that.queuedFiles[key].length : 0);
		processQueue(file, variation, require('./storage'));
	});

	this.on('error', function(err, file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.error('[queue] Error processing file %s: %s', key, err);
		processQueue(file, variation);
	});

}
util.inherits(Queue, events.EventEmitter);


Queue.prototype.add = function(file, variation, processorName) {

	var that = this;
	var key = variation ? file.id + '/' + variation.name : file.id;
	var processor = require('./processor/' + processorName);

	// mark file as being processed
	this.queuedFiles[key] = [];

	// run pass 1 if available in processor
	if (processor.pass1 && variation) {
		processor.pass1(file, variation, function(err) {
			if (err) {
				return that.emit('error', err, file, variation);
			}
			that.emit('processed', file, variation, processorName, 'finishedPass1');
		});

	} else {
		that.emit('finishedPass1', file, variation, processorName);
	}
};

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
	this.queues.image.count().then(function(count) {
		logger.info('[queue] Cleaning %d entries out of image queue.', count);
		that.image.empty();
	});
	this.queues.video.count().then(function(count) {
		logger.info('[queue] Cleaning %d entries out of video queue.', count);
		that.video.empty();
	});
};

module.exports = new Queue();