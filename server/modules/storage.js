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
			fs.unlinkSync(file.getPath());
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

Storage.prototype.url = function(obj) {
	return '/storage/' + obj._id;
}

module.exports = new Storage();