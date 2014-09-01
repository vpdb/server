/** DEPRECATED, part of mock API, delete when mock replaced. */

"use strict";

var fs = require('fs');
var gm = require('gm');
var md5 = require('md5');
var util = require('util');
var path = require('path');
var logger = require('winston');
var request = require('request');

var writeable = require('./writeable');
var disableCache = false;

/**
 * Renders a square image.
 *
 * @param context Contains res and ret
 * @param type Entity type, one of: [ "release" ]
 * @param key Entity key or ID
 * @param size Size params, width and height.
 */
exports.square = function(context, type, key, size) {

	if (type === 'release') {
		var p = __dirname + '/../../data/assets/cabinet/' + key + '.png';

		asset(context, p, function(gm, callback) {
			gm.size(function(err, srcSize) {
				if (err) {
					logger.error('[asset] Error resizing: %s', err);
				}
				var scale = srcSize.height / 1920;
				gm.rotate('black', -30);
				gm.crop(590 * scale, 590 * scale, 800 * scale, 1100 * scale);
				if (size !== null) {
					gm.resize(size, size);
				}
				callback(gm);
			});
		}, type, key, size);

	} else {
		context.res.writeHead(404);
		context.res.end('Unknown type "' + type + '".');
	}
};

var asset = function(context, p, processFct, type, key, size, defaultName) {


	if (p && fs.existsSync(p)) {

		// browser caching
		var fd = fs.openSync(p, 'r');
		var modified = new Date(fs.fstatSync(fd).mtime);
		fs.closeSync(fd);
		var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
		if (modified.getTime() >= ifmodifiedsince.getTime() && !disableCache) {
			context.res.writeHead(304);
			context.res.end();
			return;
		}

		// file caching
		var hash = md5.digest_s(type + ':' + ':' + key + ':' + size);
		var filename = writeable.imgCache + '/' + hash + '.png';
		if (fs.existsSync(filename)) {
			//logger.info('[asset] File cache hit, returning ' + filename);
			return file(context, filename);
		} else {
			logger.info('[asset] No cache hit for ' + filename);
		}

		// cache, process.
		var now = new Date().getTime();
		processFct(gm(p), function(gm) {

			// stream to client
			gm.stream(function(err, stream) {
				if (err) {
					logger.error('[asset] ERROR streaming image: ' + err);
					return context.res.writeHead(500);
				}
				context.res.writeHead(200, {
					'Content-Type': 'image/png',
					'Cache-Control': 'private',
					'Last-Modified': modified
				});
				stream.pipe(context.res);
				logger.info('[asset] Generated in %d ms.', new Date().getTime() - now);
			});
		});

		// save to cache
		processFct(gm(p), function(gm) {
			gm.write(filename, function(err) {
				if (err) {
					return logger.error('[asset] Error writing asset cache to %s: %s', filename, err);
				}
				logger.info('[asset] Successfully wrote asset cache to %s.', filename);
			});
		});

	} else {
		logger.warn('[asset] No asset found for %s.', p);
		if (defaultName) {
			context.res.writeHead(200, {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'private'
			});
			fs.createReadStream(__dirname + '/../../client/static/images/' + defaultName).pipe(context.res);
		} else {
			context.res.writeHead(404);
			context.res.end('Sorry, ' + p + ' not found.');
		}
	}
};

var file = function(context, path) {
	context.res.writeHead(200, { 'Content-Type': 'image/png' });
	var stream = fs.createReadStream(path);
	stream.pipe(context.res);
};
