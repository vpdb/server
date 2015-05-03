/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var fs = require('fs');
var async = require('async');
var logger = require('winston');

var File = require('mongoose').model('File');
var quota = require('../../modules/quota');
var storage = require('../../modules/storage');
var acl = require('../../acl');


/**
 * Downloads a single file.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.get = function(req, res, authErr) {

	find(req, res, authErr, function(file, isFree) {

		if (isFree) {
			return serve(req, res, file, req.params.variation);
		}

		// check the quota
		quota.isAllowed(req, res, file, function(err, granted) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[storage|files] Error checking quota for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			if (!granted) {
				return res.status(403).json({ error: 'No more quota left.' }).end();
			}
			serve(req, res, file, req.params.variation);
		});
	});
};

/**
 * Checks if a file exists.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.head = function(req, res, authErr) {
	find(req, res, authErr, function(file) {
		return serve(req, res, file, req.params.variation, true);
	});
};


/**
 * Retrieves a storage item and does all checks but the quota check. If any
 * check fails, it responds to the client.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {function} callback Callback with {File} object as first argument (treats errors directly) and `isPublic` as second argument (no quota checking necessary if true).
 */
function find(req, res, authErr, callback) {

	File.findOne({ id: req.params.id }, function(err, file) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[ctrl|storage] Error getting file "%s": %s', req.params.id, err, {});
			return res.status(500).end();
		}
		if (!file) {
			return res.status(404).end();
		}

		// file is not public - user must be logged in.
		if (!file.isPublic(req.params.variation) && !req.user) {
			return res.status(401).json({ error: 'You must provide valid credentials for non-public files.', cause: authErr.message }).end();
		}

		// if inactive and user is not logged or not the owner, refuse.
		if (!file.is_active) {
			if (!req.user) {
				return res.status(401).json({ error: 'You must provide credentials for inactive files.', cause: authErr.message }).end();
			}
			if (!file._created_by.equals(req.user._id)) {
				return res.status(403).json({ error: 'You must own inactive files in order to access them.' }).end();
			}
		}

		// at this point, we can serve the file if it's free
		if (file.isPublic(req.params.variation)) {
			return callback(file, true);
		}

		// we also serve it if it's free and the user is logged
		if (file.isFree(req.params.variation) && req.user) {
			return callback(file, true);
		}

		// so here we determined the file isn't free, so we need to check ACLs.
		acl.isAllowed(req.user.id, 'files', 'download', function(err, granted) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[ctrl|storage] Error checking ACLs for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			if (!granted) {
				return res.status(403).json({ error: 'Your ACLs do not allow downloading of any files.' }).end();
			}

			// if the user is the owner, serve directly (owned files don't count as credits)
			if (file._created_by.equals(req.user._id)) {
				return callback(file, true);
			}
			callback(file, false);
		});
	});
}


/**
 * Serves a file to the user.
 *
 * For wait-while-processing logic see explanations below.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 * @param {File} file File to serve
 * @param {string} variationName Name of the variation to serve
 * @param {boolean} [headOnly=false] If set, only send the headers but no content (for `HEAD` requests)
 */
function serve(req, res, file, variationName, headOnly) {

	var serveFile = function(file, fstat) {

		// check if we should return 304 not modified
		var modified = new Date(fstat.mtime);
		var ifmodifiedsince = req.headers['if-modified-since'] ? new Date(req.headers['if-modified-since']) : false;
		if (ifmodifiedsince && modified.getTime() >= ifmodifiedsince.getTime()) {
			return res.status(304).end();
		}

		if (!headOnly) {

			// set headers and stream the file
			var filePath = file.getPath(variationName);

			if (!fs.existsSync(filePath)) {
				return res.json(500, { error: 'Error streaming ' + file.toString(variationName) + ' from storage. Please contact an admin.' });
			}
			var stream = fs.createReadStream(filePath);
			stream.on('error', function(err) {
				logger.error('[ctrl|storage] Error before streaming %s from storage: %s', file.toString(variationName), err);
				res.end();
			});

			var headers = {
				'Content-Type': file.getMimeType(variationName),
				'Content-Length': fstat.size,
				'Cache-Control': 'max-age=315360000',
				'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
			};

			if (req.query.save_as) {
				headers['Content-Disposition'] = 'attachment; filename="' + file.name + '"';
			}

			res.writeHead(200, headers);
			stream.pipe(res).on('error', function(err) {
				logger.error('[ctrl|storage] Error while streaming %s from storage: %s', file.toString(variationName), err);
				res.end();
			});

			// count download
			if (!variationName) {
				var counters = [];
				counters.push(function(next) {
					file.incrementCounter('downloads', next);
				});
				if (!file.isFree(variationName)) {
					counters.push(function (next) {
						req.user.incrementCounter('downloads', next);

					});
				}
				async.series(counters);
			}

			// only return the header if request was HEAD
		} else {
			res.writeHead(200, {
				'Content-Type': file.getMimeType(variationName),
				'Content-Length': 0,
				'Cache-Control': 'max-age=315360000',
				'Last-Modified': modified.toISOString().replace(/T/, ' ').replace(/\..+/, '')
			});
			return res.end();
		}
	};

	storage.fstat(file, variationName, function(err, fstat) {
		if (err) {
			logger.error('[ctrl|storage] Error while fstating %s: %s', file.toString(variationName), err);
			return res.status(500).end();
		}

		if (fstat && fstat.size > 0) {
			serveFile(file, fstat);

		} else {
			/*
			 * So the idea is the following:
			 *
			 * The user uploads let's say an image, a backglass at 1280x1024 that weights 2.5M. As uploading takes already
			 * long enough, we don't want the user wait another minute until the post-processing stuff is done (i.e.
			 * creating thumbs and running everything through pngquant and optipng).
			 *
			 * For this reason, when uploading, the API only reads image meta data and instantly returns the payload that
			 * contains URLs for not-yet-generated thumbs. The post-processing is then launched in the background.
			 *
			 * Now, when the client accesses the not-yet-generated thumb, we end up here. By calling `whenProcessed()`, we
			 * ask the `storage` module to let us know when processing for that file and variation has finished (if there
			 * wasn't actually any processing going on, it will instantly return null).
			 *
			 * That means that the client's request for the image is delayed until the image is ready and then instantly
			 * delivered.
			 *
			 * The client can also use the same mechanism if it just wants to wait and do something else by issueing a HEAD
			 * request on the resource, so no data is transferred.
			 */
			logger.info('[ctrl|storage] Waiting for %s/%s to be processed...', file.id, variationName);
			storage.whenProcessed(file, variationName, function(file, fstat) {
				if (!fstat) {
					logger.info('[ctrl|storage] No processing or error, returning 404.');
					return res.status(404).end();
				}
				serveFile(file, fstat);
			});
		}
	});
}