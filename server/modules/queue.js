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

"use strict";

var _ = require('lodash');
var fs = require('fs');
var queue = require('bull');
var util  = require('util');
var redis = require('redis');
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
 * 1. A new file was uploaded and Queue##add is called. Redis is updated so we know it's being processed.
 * 2. Pass 1 is instantly executed on the appropriate processor.
 * 3. When pass 1 is finished, the "processed" event is emitted.
 * 4. The storage module, which is subscribed to the "processed" event finishes pass 1 by
 *    - retrieving meta-data of the new file
 *    - updating the "variations" field of the file
 *    - saving the file to the DB
 *    - emitting the "finishedPass1" event
 * 5. The "finishedPass1" triggers two things:
 *    - Run eventual callbacks at this.queuedFiles, since now we have a file to offer
 *    - Start pass 2, which adds a job to the Bull queue containing the file id, variation if set and the processor name.
 * 6. At some point, the processFile method below gets called by Bull. It:
 *    - fetches the file object from the DB using the file id
 *    - instantiates the processor using the name
 *    - executes the processor with the file
 * 7. The processor does its thing and emits the "processed" event.
 * 8. Again, the storage module catches the event, retrieves metadata, updates the database, but this time emits the
 *    "finishedPass2" event.
 * 9. The queue module checks for eventual callbacks and calls them if necessary, otherwise concludes the life cycle.
 *
 * A few notes:
 *  - This flow is repeated for each variation plus the original file.
 *  - If the processor module does not define a pass1() method, step 2.-4. are skipped and pass 2 is started
 *    immediately.
 *  - If there is no pass2() in the processor, the flow finishes with step 5.
 *  - See comments of each processing module what is done in pass1 and pass2.
 *  - The queuedFiles callbacks are triggered via Redis pub/sub pattern, since as soon as we have multiple Node
 *    processes (in production), our "static" variable doesn't do the trick anymore since requests are very likely
 *    handled by another processs than the queue process.
 *
 * @constructor
 */
function Queue() {

	events.EventEmitter.call(this);

	var that = this;

	this.queuedFiles = {}; // contains callbacks for potential controller requests of not-yet-processed files

	var redisOpts = {
		redis: {
			port: config.vpdb.redis.port,
			host: config.vpdb.redis.host,
			opts: {},
			DB: config.vpdb.redis.db
		}
	};

	// we have 4 queues
	this.queues = {
		image: queue('image', redisOpts),
		video: queue('video', redisOpts),
		table: queue('table', redisOpts),
		directb2s: queue('directb2s', redisOpts)
	};

	// we have 3 redis clients
	this.redis = {
		subscriber: redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true }),
		publisher: redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true }),
		status: redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true })
	};
	_.each(this.redis, function(client) {
		client.select(config.vpdb.redis.db);
		client.on('error', /* istanbul ignore next */ function(err) {
			logger.error('[queue] Redis error: ' + err);
			logger.error(err.stack);
		});
	});

	// setup pub/sub
	this.redis.subscriber.on('subscribe', (channel, count) => {
		logger.verbose('[queue] Subscribed to channel "%s" (%d).', channel, count);
	});
	this.redis.subscriber.on('unsubscribe', (channel, count) => {
		logger.verbose('[queue] Unsubscribed from channel "%s" (%d).', channel, count);
	});
	this.redis.subscriber.on('message', (key, data) => {

		data = JSON.parse(data);

		// check if we have callbacks for that channel
		if (!this.queuedFiles[key]) {
			return;
		}
		// unsubscribe from channel
		this.redis.subscriber.unsubscribe(key);

		var storage = require('./storage');
		var File = require('mongoose').model('File');
		File.findById(data.fileId, (err, file) => {
			var success = true;
			/* istanbul ignore if */
			if (err) {
				logger.error('[queue|subscriber] Error getting file with ID "%s": %s', data.fileId, err.message);
				success = false;
			}
			if (!file) {
				logger.error('[queue|subscriber] Cannot find file with ID "%s".', data.fileId);
				success = false;
			}

			var callbacks = this.queuedFiles[key];
			delete this.queuedFiles[key];
			callbacks.forEach(callback => {
				if (!data.success || !success) {
					return callback(file);
				}
				storage.fstat(file, data.variation, (err, fstat) => {
					/* istanbul ignore if */
					if (err) {
						logger.error('[queue|subscriber] Error fstating file %s: %s', file.toString(data.variation), err.message);
					}
					callback(file, fstat);
				});
			});
		});
	});

	this.queues.image.on('failed', /* istanbul ignore next */ function(job, err) {
		// TODO treat waiting requests (to test: make pngquant fail, i.e. add pngquant's pngquant-bin dep).
		logger.error('[queue] From image queue: %s', err.message);
		logger.error(err.stack);
	});

	this.queues.video.on('failed', /* istanbul ignore next */ function(job, err) {
		// TODO treat waiting requests
		logger.error('[queue] From video queue: %s', err.message);
		logger.error(err.stack);
	});

	this.queues.table.on('failed', /* istanbul ignore next */ function(job, err) {
		// TODO treat waiting requests
		logger.error('[queue] From table queue: %s', err.message);
		logger.error(err.stack);
	});

	this.queues.directb2s.on('failed', /* istanbul ignore next */ function(job, err) {
		// TODO treat waiting requests
		logger.error('[queue] From directb2s queue: %s', err.message);
		logger.error(err.stack);
	});

	/**
	 * Processes callback queue (waiting requests)
	 */
	var processQueue = function(err, file, variation) {
		if (!file) {
			return;
		}
		var key = that.getQueryId(file, variation);

		// clear the status...
		that.redis.status.del(that.getRedisId(key), function(err) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[queue] Error deleting value "%s" from Redis: %s', that.getRedisId(key), err.message);
				return;
			}

			// ...and send the event to the subscribers
			var data;
			if (!err) {
				data = { fileId: file._id.toString(), variation: variation, success: true };
			} else {
				data = { fileId: file._id.toString(), success: false, message: err.message };
			}
			that.redis.publisher.publish(key, JSON.stringify(data));
		});
	};

	// setup workers
	this.queues.image.process(job => processFile(job, this));
	this.queues.video.process(job => processFile(job, this));
	this.queues.table.process(job => processFile(job, this));
	this.queues.directb2s.process(job => processFile(job, this));

	this.on('started', function(file, variation, processorName) {
		logger.verbose('[queue] Starting %s processing of %s', processorName, file.toString(variation));
	});

	this.on('finishedPass1', function(file, variation, processor, processed) {

		var key = this.getQueryId(file, variation);
		this.redis.status.get(this.getRedisId(key), function(err, num) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[queue] Error getting value "%s" from Redis: %s', that.getRedisId(key), err.message);
				return;
			}
			// run pass 2
			if (processor.pass2) {
				if (processed) {
					logger.verbose('[queue] Pass 1 finished, adding %s to queue (%d callbacks).', file.toString(variation), num || 0);
				} else {
					logger.verbose('[queue] Pass 1 skipped, continuing %s with pass 2.', file.toString(variation));
				}
				that.queues[processor.name].add({ fileId: file._id, variation: variation }, { processor: processor.name });
			}

			// only process callback queue if there actually was some result in pass 1
			if (processed) {
				processQueue(null, file, variation);
			}
		});
	});

	this.on('finishedPass2', function(file, variation) {
		var key = this.getQueryId(file, variation);
		this.redis.status.get(this.getRedisId(key), function(err, num) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[queue] Error getting value "%s" from Redis: %s', that.getRedisId(key), err.message);
				return;
			}
			logger.verbose('[queue] Finished processing of %s, running %d callback(s).', file.toString(variation), num || 0);

			processQueue(null, file, variation);
		});
	});

	this.on('error', function(err, file, variation) {
		logger.warn('[queue] Error processing %s: %s', file ? file.toString(variation) : '[null]', err.message || err);
		console.log(err.stack);
		processQueue(err, file, variation);
	});

}
util.inherits(Queue, events.EventEmitter);



/**
 * Runs pass 1 (if available) and adds it to the queue of pass 2.
 *
 * @param {File} file File to process
 * @param {Object} processor Processor
 * @param {Object|String} [variation] Variation to process
 * @return {Promise} Resolved when pass 1 is done and file is added to the queue for pass 2
 */
Queue.prototype.add = function(processor, file, variation) {

	Promise.try(() => {

		// run pass 1 if available in processor
		if (processor.pass1 && variation) {

			// check for source file availability
			if (!fs.existsSync(file.getPath())) {
				logger.warn('[queue|pass1] Aborting before pass 1, %s is not on file system.', file.toString(variation));
				return this.emit('error', 'File gone before pass 1 could start.', file, variation);
			}

			file.lock(variation);
			return processor.pass1(file.getPath(), file.getPath(variation), file, variation).then(skipped => {
				file.unlock(variation);
				if (skipped) {
					this.emit('finishedPass1', file, variation, processor, false);
				} else {
					this.emit('processed', file, variation, processor, 'finishedPass1');
				}
			}).catch(err => {
				this.emit('error', err, file, variation);
			});

		} else {
			this.emit('finishedPass1', file, variation, processor, false);
		}
	});
};

Queue.prototype.isQueued = function(file, variationName, done) {
	var that = this;
	var key = this.getQueryId(file, variationName);
	this.redis.status.get(this.getRedisId(key), function(err, num) {
		/* istanbul ignore if */
		if (err) {
			logger.error('[queue] Error getting value "%s" from Redis.', that.getRedisId(key));
			return done();
		}
		done(null, num !== null);
	});
};

/**
 * Initializes the callback counter to 0.
 * @param {File} file
 * @param {Object|String} [variation]
 * @returns {Promise}
 */
Queue.prototype.initCallback = function(file, variation) {
	let key = this.getQueryId(file, variation);
	return new Promise((resolve, reject) => {
		this.redis.status.set(this.getRedisId(key), 0, err => {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	})
};


Queue.prototype.addCallback = function(file, variationName, callback, done) {
	var that = this;
	var key = this.getQueryId(file, variationName);
	this.redis.status.incr(this.getRedisId(key), function() {
		if (!that.queuedFiles[key]) {
			that.queuedFiles[key] = [];
		}
		that.queuedFiles[key].push(callback);
		that.redis.subscriber.subscribe(key);
		logger.verbose('[queue] Added new callback to %s.', key);
		if (done) {
			done();
		}
	});
};

Queue.prototype.getQueryId = function(file, variation) {
	var variationName = _.isObject(variation) ? variation.name : variation;
	return variationName ? file.id + ':' + variationName : file.id;
};

Queue.prototype.getRedisId = function(key) {
	return 'queue:' + key;
};

Queue.prototype.empty = function() {
	var that = this;
	this.queues.image.count().then(function(count) {
		logger.verbose('[queue] Cleaning %d entries out of image queue.', count);
		that.queues.image.empty();
	});
	this.queues.video.count().then(function(count) {
		if (that.video) {
			logger.verbose('[queue] Cleaning %d entries out of video queue.', count);
			that.queues.video.empty();
		}
	});
};

module.exports = new Queue();

/**
 * Unserializes file ID into file and processor name into processor
 * instance and starts processing.
 *
 * @param job
 * @param emitter
 * @returns {Promise}
 */
function processFile(job, emitter) {

	//console.log('OPTS = %s, %s', require('util').inspect(job.opts), _.isObject(job.opts));
	let opts = job.opts;
	let processor = require('./processor/' + opts.processor);
	let File = require('mongoose').model('File');

	let finalDest = false;
	let file, src, dest;
	let srcModificationTime;
	let variation = job.data.variation;

	return Promise.try(() => {
		return File.findById(job.data.fileId);

	}).then(f => {

		file = f;
		if (!file) {
			throw new Error('[queue|pass2] Aborting before pass 2, file "' + job.data.fileId + '" is not in database.');
		}

		// define paths
		src = file.getPath(variation);
		dest = file.getPath(variation, '_processing');

		if (!fs.existsSync(src)) { // no processed file could also mean first pass skipped, so try with original -> variation
			src = file.getPath();
			finalDest = file.getPath(variation);
		}

		/* istanbul ignore if */
		if (!fs.existsSync(src)) {
			throw new Error('[queue|pass2] Aborting before pass 2, ' + file.toString(variation) + ' is not on file system.');
		}

		srcModificationTime = fs.statSync(src).mtime;
		file.lock(variation);
		return processor.pass2(src, dest, file, variation).catch(err => {
			if (fs.existsSync(dest)) {
				logger.info('[queue] Pass2 destination "%s" exists, removing.', dest);
				fs.unlinkSync(dest);
			}
			emitter.emit('error', err, file, variation);
			throw err;

		}).finally(() => file.unlock(variation));

	}).then(() => {

		// switch images
		if (fs.existsSync(src) && fs.existsSync(dest)) {
			let mvSrc = dest;
			let mvDest = src;

			try {
				if (finalDest === false) {
					logger.info('[queue] Removing "%s".', mvDest);
					fs.unlinkSync(mvDest);
				} else {
					mvDest = finalDest;
				}
				fs.renameSync(mvSrc, mvDest);
				logger.info('[queue] Renamed "%s" to "%s".', mvSrc, mvDest);
			} catch (err) {
				logger.error('[queue] Error switching %s to %s: %s', mvSrc, mvDest, err.message);
			}
		}
		logger.info('[queue|pass2] Pass 2 done for %s', file.toString(variation));
		emitter.emit('processed', file, variation, processor, 'finishedPass2');

	}).catch(err => {
		// silently log if thrown explicitly
		if (err.message[0] === '[') {
			logger.error(err.message);
		} else {
			throw err;
		}
	});
}