var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var File = require('mongoose').model('File');
var config = require('../modules/settings').current;
var quota = require('../modules/quota');
var storage = require('../modules/storage');
var acl = require('../acl');

var serve = function(req, res, file, variation) {

	var info = storage.info(file, variation);

	if (info) {
		res.writeHead(200, {
			'Content-Type': file.mimeType,
			'Content-Length':  info.size
		});
		var stream = fs.createReadStream(file.getPath(variation));
		stream.pipe(res);
	} else {
		res.writeHead(404).end();
	}

};

exports.get = function(req, res) {

	File.findById(req.params.id, function(err, file) {
		if (err) {
			logger.error('[storage] Error getting file "%s": %s', req.params.id, err, {});
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
						logger.error('[storage] Error checking ACLs for <%s>: %s', req.user.email, err, {});
						return res.status(500).end();
					}
					if (!granted) {
						return res.status(403).end();
					}

					// and the quota
					quota.isAllowed(req, res, file, function(err, granted) {
						if (err) {
							logger.error('[storage] Error checking quota for <%s>: %s', req.user.email, err, {});
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
