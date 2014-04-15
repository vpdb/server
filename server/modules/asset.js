'use strict';

var fs = require('fs');
var gm = require('gm');

var disableCache = true;

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
		var path = __dirname + '/../../data/assets/cabinet/' + key + '.png';

		asset(context, path, function(gm, callback) {
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
		});

	} else {
		context.res.writeHead(404);
		context.res.end('Unknown type "' + type + '".');
	}
};

var asset = function(context, path, process, defaultName) {
	if (path && fs.existsSync(path)) {

		// caching
		var fd = fs.openSync(path, 'r');
		var modified = new Date(fs.fstatSync(fd).mtime);
		fs.closeSync(fd);
		var ifmodifiedsince = new Date(context.req.headers['if-modified-since']);
		if (modified.getTime() >= ifmodifiedsince.getTime() && !disableCache) {
			context.res.writeHead(304);
			context.res.end();
			return;
		}

		// cache, process.
		var now = new Date().getTime();
		process(gm(path), function(gm) {
			gm.stream(function (err, stream) {
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
				console.log("image processed in %d ms.", new Date().getTime() - now);
			});
		});
	} else {
		console.warn('[asset] No asset found for %s.', path);
		if (defaultName) {
			context.res.writeHead(200, {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'private'
			});
			fs.createReadStream(__dirname + '/../../client/static/images/' + defaultName).pipe(context.res);
		} else {
			context.res.writeHead(404);
			context.res.end('Sorry, ' + path + ' not found.');
		}
	}
};
