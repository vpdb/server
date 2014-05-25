var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var File = require('mongoose').model('File');
var config = require('../modules/settings').current;
var acl = require('../acl');

var serve = function(req, res, file) {
	res.writeHead(200, {
		'Content-Type': file.mimeType,
		'Content-Length': file.bytes
	});
	var stream = fs.createReadStream(path.resolve(config.vpdb.storage, file._id.toString()));
	stream.pipe(res);
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
		if (!file.public) {
			if (!req.isAuthenticated()) {
				return res.status(401).end();
			} else {
				acl.isAllowed(req.user.email, 'files', 'download', function(err, granted) {
					if (err) {
						logger.error('[storage] Error checking ACLs for <%s>: %s', req.user.email, err, {});
						return res.status(500).end();
					}
					if (!granted) {
						return res.status(403).end();
					}
					if (!file.active && !file.author.equals(req.user._id)) {
						return res.status(404).end();
					}
					serve(req, res, file);
				});
			}
		} else {
			if (!file.active && (!req.isAuthenticated() || file.author.equals(req.user._id))) {
				return res.status(404).end();
			}
			serve(req, res, file);
		}
		if (!file.public && !req.isAuthenticated()) {
			return res.status(403).end();
		}
	});
};
