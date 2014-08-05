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
	var mime = file.mime_type.split('/');
	var type = mime[0];
	var subtype = mime[1];

	var that = this;
	var File = require('mongoose').model('File');
	var PngQuant = require('pngquant');
	var OptiPng = require('optipng');

	switch(type) {
		case 'image':
			if (this.variations[type][file.file_type]) {

				// mark all variations of being processed.
				_.each(this.variations[type][file.file_type], function(variation, next) {
					that.emit('postProcessStarted', file, variation);
				});

				// process variations
				async.eachSeries(this.variations[type][file.file_type], function(variation, next) {

					if (!fs.existsSync(file.getPath())) {
						return next('File "' + file.getPath() + '" gone, has been removed before processing finished.');
					}

					var filepath = file.getPath(variation.name);
					var writeStream = fs.createWriteStream(filepath);
					var handleErr = function(err) {
						next(err);
					};
					writeStream.on('finish', function() {
						logger.info('[storage] Saved resized image to "%s".', filepath);

						if (!fs.existsSync(filepath)) {
							return next('File "' + filepath + '" gone, has been removed before processing finished.');
						}

						// update database with new variation
						gm(filepath).identify(function(err, value) {
							if (err) {
								logger.warn('[storage] Error reading metadata from image: %s', err);
								return next();
							}

							// re-fetch so we're sure no updates are lost
							var fileId = file.id;
							File.findById(file._id, function(err, file) {
								if (err) {
									logger.warn('[storage] Error re-fetching image: %s', err);
									return next(err);
								}

								// check that file hasn't been erased meanwhile (hello, tests!)
								if (!file) {
									return next('File "' + fileId + '" gone, has been removed before processing finished.');
								}
								if (!fs.existsSync(filepath)) {
									return next('File "' + filepath + '" gone, has been deleted before processing finished.');
								}

								if (!file.variations) {
									file.variations = {};
								}

								file.variations[variation.name] = {
									bytes: fs.statSync(filepath).size,
									width: value.size.width,
									height: value.size.height
								};

								logger.info('[storage] Updating file "%s" with variation %s.', file.id, variation.name);
								// change to file.save when fixed: https://github.com/LearnBoost/mongoose/issues/1694
								File.findOneAndUpdate({ _id: file._id }, _.omit(file.toJSON(), [ '_id', '__v' ]), {}, function(err, f) {
									that.emit('postProcessFinished', file, variation);
									next(err);
								});
							});
						});
					});
					writeStream.on('error', handleErr);

					if (subtype === 'png') {
						var quanter = new PngQuant([128]);
						var optimizer = new OptiPng(['-o7']);

						logger.info('[storage] Resizing and optimizing "%s" for %s %s...', file.name, variation.name, file.file_type);
						if (!fs.existsSync(file.getPath())) {
							logger.error('[storage] File "%s" not available anymore, aborting.', file.getPath());
							return done('File "' + file.getPath() + '" not available anymore, aborting.');
						}
						if (config.vpdb.skipImageOptimizations) {
							gm(file.getPath()).resize(variation.width, variation.height).stream()
								.pipe(writeStream).on('error', handleErr);
						} else {
							gm(file.getPath()).resize(variation.width, variation.height).stream()
								.pipe(quanter).on('error', handleErr)
								.pipe(optimizer).on('error', handleErr)
								.pipe(writeStream).on('error', handleErr);
						}

					} else {

						logger.info('[storage] Resizing "%s" for %s %s...', file.name, variation.name, file.file_type);
						gm(file.getPath()).resize(variation.width, variation.height).stream().pipe(writeStream).on('error', handleErr);
					}
				}, function(err) {
					if (err) {
						logger.warn('[storage] Error processing variations: %s', err, {});
						if (fs.existsSync(file.getPath())) {
							fs.unlinkSync(file.getPath());
						}
						return done(err);
					}
					if (subtype !== 'png') {
						return done();
					}

					// now we're done with the variations, optimize the actual image.
					var tmppath = file.getPath() + '_tmp';
					var writeStream = fs.createWriteStream(tmppath);
					writeStream.on('finish', function() {
						logger.info('[storage] All done, switching images..');
						if (fs.existsSync(file.getPath())) {
							fs.unlinkSync(file.getPath());
						}
						if (fs.existsSync(tmppath)) {
							fs.rename(tmppath, file.getPath(), done);
						} else {
							done();
						}
					});

					var quanter = new PngQuant([128]);
					var optimizer = new OptiPng(['-o7']);

					logger.info('[storage] Optimizing %s "%s"...', file.file_type, file.name);
					if (config.vpdb.skipImageOptimizations) {
						fs.createReadStream(file.getPath()).pipe(writeStream);
					} else {
						fs.createReadStream(file.getPath()).pipe(quanter).pipe(optimizer).pipe(writeStream);
					}
				});
			} else {
				done();
			}
			break;
		default:
			done();
	}
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