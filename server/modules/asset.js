'use strict';

var fs = require('fs');
var gm = require('gm');
var md5 = require('md5');
var util = require('util');
var path = require('path');
var request = require('request');

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

	if (type == 'release') {
		var p = __dirname + '/../../data/assets/cabinet/' + key + '.png';

		asset(context, p, function(gm, callback) {
			gm.size(function(err, srcSize) {
				if (err) {
					console.error(err);
				}
				var scale = srcSize.height / 1920;
				gm.rotate('black', -30);
				gm.crop(590 * scale, 590 * scale, 800 * scale, 1100 * scale);
				if (size != null) {
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

	// setup cache dir
	var cacheImg;
	var cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.normalize(__dirname + '../../../gen');
	if (fs.existsSync(cacheRoot)) {
		cacheImg = cacheRoot + '/img';
		if (!fs.existsSync(cacheImg)) {
			fs.mkdirSync(cacheImg);
		}
	} else {
		cacheImg = null;
	}

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
		if (cacheImg) {
			var hash = md5.digest_s(type + ':' + ':' + key + ':' + size);
			var filename = cacheImg + '/' + hash + '.png';
			if (fs.existsSync(filename)) {
				console.log('File cache hit, returning ' + filename);
				return file(context, filename);
			} else {
				console.log('No cache hit for ' + filename);
			}
		}

		// cache, process.
		var now = new Date().getTime();
		processFct(gm(p), function(gm) {

			// stream to client
			gm.stream(function(err, stream) {
				if (err) {
					logger.log('error', '[asset] ERROR streaming image: ' + err);
					return context.res.writeHead(500);
				}
				context.res.writeHead(200, {
					'Content-Type': 'image/png',
					'Cache-Control': 'private',
					'Last-Modified': modified
				});
				stream.pipe(context.res);
				console.log("Asset processed in %d ms.", new Date().getTime() - now);
			});
		});

		// FIXME don't process twice (tried to fix, but when chaining write() after stream(), the unprocessed image gets saved).
		// save to cache
		processFct(gm(p), function(gm) {
			gm.write(filename, function(err) {
				if (err) {
					return console.error('Error writing asset cache to ' + filename + ': ' + err);
				}
				console.log('Successfully wrote asset cache to ' + filename + '.');

				// now shrink it
				fs.createReadStream(filename).pipe(request.post({
					url: 'https://api.tinypng.com/shrink',
					json: true,
					headers: { 'Authorization' : 'Basic ' + new Buffer('key:X6JiKxeLNoN8Fgnpz0F7ervRS7Z8SIfW').toString('base64') }
				}, function(err, response, json) {
					if (err) {
						return console.error('Error while posting image to tinypng: %s', err);
					}
					if (response.statusCode != 201) {
						return console.error('Error shrinking image (%d): %s', response.statusCode, util.inspect(json));
					}
					request(json.output.url).pipe(fs.createWriteStream(filename));
				}));
			});
		});

	} else {
		console.warn('[asset] No asset found for %s.', p);
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
