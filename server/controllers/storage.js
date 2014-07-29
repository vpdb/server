"use strict";

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

	var serveFile = function(fstat) {

		// check if we should return 304 not modified
		var modified = new Date(fstat.mtime);
		var ifmodifiedsince = req.headers['if-modified-since'] ? new Date(req.headers['if-modified-since']) : false;
		if (ifmodifiedsince && modified.getTime() >= ifmodifiedsince.getTime()) {
			res.writeHead(304);
			res.end();
			return;
		}

		// otherwise set headers and stream the file
		res.writeHead(200, {
			'Content-Type': file.mime_type,
			'Content-Length':  fstat.size,
			'Cache-Control': 'private',
			'Last-Modified': modified
		});
		var stream = fs.createReadStream(file.getPath(variationName));
		stream.pipe(res);
	};

	var fstat = storage.fstat(file, variationName);

	if (fstat && fstat.size > 0) {
		serveFile(fstat);

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
		logger.info('[ctrl|storage] Waiting for %s/%s to be processed...', file.id, variationName);
		storage.whenProcessed(file, variationName, function(fstat) {
			if (!fstat) {
				logger.info('[ctrl|storage] No processing, returning 404.');
				return res.writeHead(404);
			}
			logger.info('[ctrl|storage] Streaming freshly processed item back to client.');
			serveFile(fstat);
		});
	}
};

exports.get = function(req, res) {

	File.findOne({ id: req.params.id }, function(err, file) {
		if (err) {
			logger.error('[ctrl|storage] Error getting file "%s": %s', req.params.id, err, {});
			return res.status(500).end();
		}
		if (!file) {
			return res.status(404).end();
		}

		// file is not public (i.e. user must be logged in order to download)
		if (!file.is_public) {

			// if not logged, deny
			if (!req.user) {
				return res.status(401).end();
			} else {

				// if inactive and user isn't the owner, refuse directly
				if (!file.is_active && !file._created_by.equals(req.user._id)) {
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
			if (!file.is_active && (!req.user || file._created_by.equals(req.user._id))) {
				return res.status(404).end();
			}
			// otherwise, serve.
			serve(req, res, file, req.params.variation);
		}
		if (!file.is_public && !req.user) {
			return res.status(403).end();
		}
	});
};
