var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var api = require('./common');
var File = require('mongoose').model('File');
var config = require('../../modules/settings').current;
var storage = require('../../modules/storage');

exports.upload = function(req, res) {
	api.auth(req, res, 'files', 'upload', function() {

		if (!req.headers['content-type']) {
			return api.fail(res, 'Header "Content-Type" must be provided.', 422);
		}
		if (!req.headers['content-disposition']) {
			return api.fail(res, 'Header "Content-Disposition" must be provided.', 422);
		}
		if (!/filename=([^;\z]+)/i.test(req.headers['content-disposition'])) {
			return api.fail(res, 'Header "Content-Disposition" must contain file name.', 422);
		}
		if (!req.query.type) {
			return api.fail(res, 'Query parameter "type" must be provided.', 422);
		}

		var file = new File({
			name: req.headers['content-disposition'].match(/filename=([^;\z]+)/i)[1].replace(/(^"|^'|"$|'$)/g, ''),
			bytes: req.headers['content-length'],
			created: new Date(),
			author: req.user._id,
			mimeType: req.headers['content-type'],
			fileType: req.query.type
		});

		file.validate(function(err) {
			if (err) {
				return api.fail(res, err, 422);
			}

			file.save(function(err, file) {
				if (err) {
					return api.fail(res, err, 500);
				}
				var writeStream = fs.createWriteStream(file.getPath());
				req.on('data', function (data) {
					writeStream.write(data);
				});
				req.on('end', function() {
					writeStream.end();
					storage.metadata(file, function(err, metadata, shortMetadata) {
						if (!err && metadata) {
							api.sanitizeObject(metadata);
							file.metadata = metadata;
						}
						var f = _.pick(file, '_id', 'name', 'bytes', 'created', 'mimeType', 'fileType');
						f.url = file.getUrl();
						f.metaData = shortMetadata;
						api.success(res, f);
						file.save(function(err) {
							if (err) {
								logger.error('[api|file:save] Error saving metadata: %s', err, {});
								logger.error('[api|file:save] Metadata: %s', require('util').inspect(metadata));
							}
						});
					});
				});
			});
		});
	});
};
