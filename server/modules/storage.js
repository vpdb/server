'use strict';

var _ = require('underscore');
var gm = require('gm');
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('winston');

var File = require('mongoose').model('File');
var config = require('./settings').current;

var dimensions = {
	backglass: [
		{ name: 'small',   width: 253, height: 202 },
		{ name: 'small2x', width: 506, height: 404 }
	]
};


function Storage() {

	// create necessary paths..
	_.each(dimensions, function(dimTypes, dimType) {
		_.each(dimTypes, function(dim) {
			var p = path.resolve(config.vpdb.storage, dim.name);
			if (!fs.existsSync(p)) {
				logger.info('[storage] Creating non-existant %s path %s', dimType, p);
				fs.mkdirSync(p);
			}
		});
	});
}

Storage.prototype.cleanup = function(graceperiod, done) {
	graceperiod = graceperiod ? graceperiod : 0;

	File.find({ active: false, created: { $lt: new Date(new Date().getTime() - graceperiod)} })
		.populate('author').
		exec(function(err, files) {
		if (err) {
			logger.error('[storage] Error getting files for cleanup: %s', err);
			return done(err);
		}

		async.eachSeries(files, function(file, next) {
			logger.info('[storage] Cleanup: Removing inactive file "%s" by <%s> (%s).', file.name, file.author.email, file._id.toString());
			if (fs.existsSync(file.getPath())) {
				fs.unlinkSync(file.getPath());
			}
			file.remove(next);
		}, done);
	});
};

Storage.prototype.metadata = function(file, done) {
	var mime = file.mimeType.split('/');
	var type = mime[0];
	var subtype = mime[1];

	switch(type) {
		case 'image':
			gm(file.getPath()).identify(function(err, value) {
				if (err) {
					logger.warning('[storage] Error reading metadata from image: %s', err);
					return done();
				}
				done(null, value, _.pick(value, 'format', 'size', 'depth', 'JPEG-Quality'));
			});
			break;
		default:
			logger.warning('[storage] No metadata parser for mime type "%s".', file.mimeType);
			done();
	}
};

Storage.prototype.postprocess = function(file, done) {
	var mime = file.mimeType.split('/');
	var type = mime[0];
	var subtype = mime[1];

	var PngQuant = require('pngquant');
	var OptiPng = require('optipng');

	switch(type) {
		case 'image':
			if (dimensions[file.fileType]) {
				async.eachSeries(dimensions[file.fileType], function(dimension, next) {

					var quanter = new PngQuant([128]);
					var optimizer = new OptiPng(['-o7']);

					var filepath = file.getPath(dimension.name);
					var writeStream = fs.createWriteStream(filepath);
					writeStream.on('finish', function() {
						logger.info('[storage] Saved quantered and optimized image to "%s".', filepath);
						next();
					});
					logger.info('[storage] Optimizing "%s" for %s %s...', file.name, dimension.name, file.fileType);
					gm(file.getPath()).resize(dimension.width, dimension.height).stream().pipe(quanter).pipe(optimizer).pipe(writeStream);

				}, done);
			} else {
				done();
			}
			break;
		default:
			done();
	}
};

Storage.prototype.url = function(obj, size) {
	return obj ? '/storage/' + obj._id + (size ? '/' + size : '') : null;
};

module.exports = new Storage();