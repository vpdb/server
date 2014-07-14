var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var File = require('mongoose').model('File');
var config = require('../modules/settings').current;
var quota = require('../modules/quota');
var storage = require('../modules/storage');
var acl = require('../acl');

var serve = function(req, res, file, variationName) {

	var info = storage.info(file, variationName);

	if (info && info.size > 0) {
		logger.info('[ctrl|storage] Returning %s/%s to client...', file._id.toString(), variationName);
		res.writeHead(200, {
			'Content-Type': file.mimeType,
			'Content-Length':  info.size
		});
		var stream = fs.createReadStream(file.getPath(variationName));
		stream.pipe(res);

	} else {
		/*
		 * So the idea is the following:
		 *
		 * The user uploads let's say an image, a backglass at 1280x1024 that weights 2.5M. As uploading takes already
		 * long enough, we don't want the user wait another minute until the post-processing stuff is done (i.e.
		 * creating thumbs and running everything through pngquant and optipng).
		 *
		 * For this reason, when uploading, the API only reads image meta data and instantly returns the payload that
		 * contains urls for not-yet-generated thumbs. The post-processing is then launched in the background.
		 *
		 * Now, when the client accesses the not-yet-generated thumb, we end up here. By calling `whenProcessed()`, we
		 * ask the `storage` module to let us know when processing for that file and variation has finished (if there
		 * wasn't actually any processing going on, it will instantly return null).
		 *
		 * That means that the client's request for the image is delayed until the image is ready and then instantly
		 * delivered.
		 */
		logger.info('[ctrl|storage] Waiting for %s/%s to be processed...', file._id.toString(), variationName);
		storage.whenProcessed(file, variationName, function(info) {
			if (!info) {
				logger.info('[ctrl|storage] No processing, returning 404.');
				return res.writeHead(404);
			}
			logger.info('[ctrl|storage] Streaming freshly processed item back to client.');
			res.writeHead(200, {
				'Content-Type': file.mimeType,
				'Content-Length':  info.size
			});
			var stream = fs.createReadStream(file.getPath(variationName));
			stream.pipe(res);
		});
	}

};

exports.get = function(req, res) {

	File.findById(req.params.id, function(err, file) {
		if (err) {
			logger.error('[ctrl|storage] Error getting file "%s": %s', req.params.id, err, {});
			return res.status(500).end();
		}
		if (!file) {
			return res.status(404).end();
		}

		// file is not public (i.e. user must be logged in order to download)
		if (!file.public) {

			// if not logged, deny
			if (!req.user) {
				return res.status(401).end();
			} else {

				// if inactive and user isn't the owner, refuse directly
				if (!file.active && !file.author.equals(req.user._id)) {
					return res.status(404).end();
				}

				// otherwise, check acl
				acl.isAllowed(req.user.email, 'files', 'download', function(err, granted) {
					if (err) {
						logger.error('[ctrl|storage] Error checking ACLs for <%s>: %s', req.user.email, err, {});
						return res.status(500).end();
					}
					if (!granted) {
						return res.status(403).end();
					}

					// and the quota
					quota.isAllowed(req, res, file, function(err, granted) {
						if (err) {
							logger.error('[ctrl|storage] Error checking quota for <%s>: %s', req.user.email, err, {});
							return res.status(500).end();
						}
						if (!granted) {
							return res.status(403).end();
						}
						serve(req, res, file, req.params.variation);
					});
				});
			}

		// file is public
		} else {

			// but not active and user isn't the owner
			if (!file.active && (!req.user || file.author.equals(req.user._id))) {
				return res.status(404).end();
			}
			// otherwise, serve.
			serve(req, res, file, req.params.variation);
		}
		if (!file.public && !req.user) {
			return res.status(403).end();
		}
	});
};
