'use strict';

var _ = require('underscore');
var gm = require('gm');
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('winston');

var File = require('mongoose').model('File');
var config = require('./settings').current;

function Storage() {

	this.variationNames = [];
	var that = this;

	// create necessary paths..
	_.each(this.variations, function(variations, fileType) {
		_.each(variations, function(variation) {
			var variationPath = path.resolve(config.vpdb.storage, variation.name);
			if (!fs.existsSync(variationPath)) {
				logger.info('[storage] Creating non-existant path for variation "%s" at %s', variation.name, variationPath);
				fs.mkdirSync(variationPath);
			}
			if (!_.contains(that.variationNames), variation.name) {
				that.variationNames.push(variation.name);
			}
		});
	});
}

Storage.prototype.variations = {
	backglass: [
		{ name: 'small',   width: 253, height: 202 },
		{ name: 'small-2x', width: 506, height: 404 }
	]
};


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
			if (this.variations[file.fileType]) {
				async.eachSeries(this.variations[file.fileType], function(variation, next) {

					var filepath = file.getPath(variation.name);
					var writeStream = fs.createWriteStream(filepath);
					writeStream.on('finish', function() {
						logger.info('[storage] Saved resized image to "%s".', filepath);
						next();
					});

					if (subtype == 'png') {
						var quanter = new PngQuant([128]);
						var optimizer = new OptiPng(['-o7']);

						logger.info('[storage] Resizing and optimizing "%s" for %s %s...', file.name, variation.name, file.fileType);
						gm(file.getPath()).resize(variation.width, variation.height).stream().pipe(quanter).pipe(optimizer).pipe(writeStream);

					} else {

						logger.info('[storage] Resizing "%s" for %s %s...', file.name, variation.name, file.fileType);
						gm(file.getPath()).resize(variation.width, variation.height).stream().pipe(writeStream);
					}
				}, done);
			} else {
				done();
			}
			break;
		default:
			done();
	}
};

Storage.prototype.url = function(file, variation) {
	return file ? '/storage/' + file._id + (variation ? '/' + variation : '') : null;
};

Storage.prototype.info = function(file, variation) {

	if (variation && !_.contains(this.variationNames, variation)) {
		return null;
	}

	// TODO optimize (aka "cache")
	if (variation && fs.existsSync(file.getPath(variation))) {
		return fs.statSync(file.getPath(variation));

	} else if (fs.existsSync(file.getPath())) {
		return fs.statSync(file.getPath());
	}
	return null;
}

module.exports = new Storage();