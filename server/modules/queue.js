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
var queue = require('bull');
var util  = require('util');
var events = require('events');
var logger = require('winston');

var config = require('./settings').current;

/**
 * The processing queue.
 *
 * This is used for post-processing of uploaded files and is executed asynchronously after the response has already been
 * returned to the client. For the processing, a MIME type dependent processing module is used.
 *
 * A processing module can implement two processing passes.
 *
 * - PASS 1 is spawned instantly and processed in parallel. It is only executed for variations, since the goal
 *   of pass 1 is to obtain a new variation as soon as possible (for images, that would be the resizing).
 *   If this pass is implemented, the callbacks of waiting requests will be executed after completion.
 * - PASS 2 is added to the message queue and processed only one by one. The goal of pass 2 is to further optimize
 *   the file, which could be processor-intensive (for images, that would be the PNG crunching). If pass 1 is not
 *   implemented, the callbacks of waiting requests will be executed after this pass.
 *
 * Lifecycle:
 *
 * 1. A new file was uploaded and Queue##add is called. this.queuedFiles is updated so we know it's being processed.
 * 2. Pass 1 is instantly executed on the appropriate processor.
 * 3. When pass 1 is finished, the "processed" event is emitted.
 * 4. The storage module, which is subscribed to the "processed" event finishes pass 1 by
 *    - retrieving meta-data of the new file
 *    - updating the "variations" field of the file
 *    - saving the file to the DB
 *    - emitting the "finishedPass1" event
 * 5. The "finishedPass1" triggers does two things:
 *    - Run eventual callbacks at this.queuedFiles, since now we have a file to offer
 *    - Start pass 2, which adds a job to the Bull queue containing the file id, variation if set and the processor name.
 * 6. At some point, the processFile method below gets called. It:
 *    - Fetches the file object from the DB using the file id
 *    - Instantiates the processor using the name
 *    - Executes the processor with the file
 * 7. The processor does its thing and emits the "processed" event.
 * 8. Again, the storage module catches the event, retrieves metadata, updates the database, but this time emits the
 *    "finishedPass2" event.
 * 9. The queue module checks for eventual callbacks and calls them if necessary, otherwise concludes the life cycle.
 *
 * A few notes:
 *  - This flow is repeated for each variation plus the original file.
 *  - If the processor module does not defined a pass1() method, step 2.-4. are skipped and pass 2 is started
 *    immediately.
 *  - If there is no pass2() in the processor, the flow finishes with step 5.
 *  - See comments of each processing module what is done in pass1 and pass2.
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
				logger.error('[queue|pass2] Error getting file with ID "%s".', job.data.fileId);
				return done();
			}
			var variation = job.data.variation;
			if (!file) {
				logger.warn('[queue|pass2] Aborting before pass 2, file "%s" is not in database.', job.data.fileId);
				return done();
			}
			// define paths
			var postRename = true;
			var src = file.getPath(variation);
			var dest = file.getPath(variation, '_processing');

			if (!fs.existsSync(src)) { // no processed file could also mean first pass skipped, so try with original -> variation
				postRename = false;
				src = file.getPath();
				dest = file.getPath(variation);
			}

			if (!fs.existsSync(src)) {
				logger.warn('[queue|pass2] Aborting before pass 2, %s is not on file system.', file.toString(variation));
				return done();
			}

			processor.pass2(src, dest, file, variation, function(err) {
				if (err) {
					if (fs.existsSync(dest)) {
						fs.unlinkSync(dest);
					}
					that.emit('error', err, file, variation);
					return done(err);
				}
				// switch images
				if (postRename && fs.existsSync(src) && fs.existsSync(dest)) {
					try {
						fs.unlinkSync(src);
						fs.renameSync(dest, src);
					} catch (err) {
						logger.error('[queue] Error switching %s to %s: ', dest, src, err);
					}
				}
				logger.info('[queue|pass2] Pass 2 done for %s', file.toString(variation));
				that.emit('processed', file, variation, processor, 'finishedPass2');
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
		logger.info('[queue] Starting %s processing of %s', processorName, file.toString(variation));
	});

	this.on('finishedPass1', function(file, variation, processor, processed) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		// run pass 2
		if (processor.pass2) {
			this.queues[processor.name].add({ fileId: file._id, variation: variation }, { processor: processor.name });
			if (processed) {
				logger.info('[queue] Pass 1 finished, adding %s to queue (%d callbacks).', file.toString(variation), that.queuedFiles[key] ? that.queuedFiles[key].length : 0);
			} else {
				logger.info('[queue] Pass 1 skipped, continuing %s with pass 2.', file.toString(variation));
			}
		}

		// only process callback queue if there actually was some result in pass 1
		if (processed) {
			processQueue(file, variation, require('./storage'));
		}

	});

	this.on('finishedPass2', function(file, variation) {
		var key = variation ? file.id + '/' + variation.name : file.id;
		logger.info('[queue] Finished processing of %s, running %d callback(s).', file.toString(variation), that.queuedFiles[key] ? that.queuedFiles[key].length : 0);
		processQueue(file, variation, require('./storage'));
	});

	this.on('error', function(err, file, variation) {
		logger.warn('[queue] Error processing %s: %s', file.toString(variation), err);
		processQueue(file, variation);
	});

}
util.inherits(Queue, events.EventEmitter);


Queue.prototype.add = function(file, variation, processor) {

	var that = this;
	var key = variation ? file.id + '/' + variation.name : file.id;

	// mark file as being processed
	this.queuedFiles[key] = [];

	// run pass 1 if available in processor
	if (processor.pass1 && variation) {

		// check for source file availability
		if (!fs.existsSync(file.getPath())) {
			logger.warn('[queue|pass1] Aborting before pass 1, %s is not on file system.', file.toString(variation));
			return that.emit('error', 'File gone before pass 1 could start.', file, variation);
		}

		processor.pass1(file.getPath(), file.getPath(variation), file, variation, function(err, skipped) {
			if (err) {
				return that.emit('error', err, file, variation);
			}
			if (skipped) {
				that.emit('finishedPass1', file, variation, processor, false);
			} else {
				that.emit('processed', file, variation, processor, 'finishedPass1');
			}
		});

	} else {
		that.emit('finishedPass1', file, variation, processor, false);
	}
};

Queue.prototype.isQueued = function(file, variationName) {
	var key = file.id + '/' + variationName;
	return this.queuedFiles[key] ? true : false;
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
		that.queues.image.empty();
	});
	this.queues.video.count().then(function(count) {
		if (that.video) {
			logger.info('[queue] Cleaning %d entries out of video queue.', count);
			that.queues.video.empty();
		}

	});
};

module.exports = new Queue();