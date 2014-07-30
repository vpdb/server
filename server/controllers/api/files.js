"use strict";

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var api = require('./api');
var ctrl = require('../ctrl');
var File = require('mongoose').model('File');
var config = require('../../modules/settings').current;
var storage = require('../../modules/storage');


exports.upload = function(req, res) {

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
		created_at: new Date(),
		mime_type: req.headers['content-type'],
		file_type: req.query.type,
		_created_by: req.user._id
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
			writeStream.on('finish', function() {
				storage.metadata(file, function(err, metadata, shortMetadata) {
					if (err) {
						return api.fail(res, 'Metadata parsing for MIME type "' + file.mime_type +  '" failed. Upload corrupted or weird format?', 400);
					}
					if (metadata) {
						api.sanitizeObject(metadata);
						file.metadata = metadata;
					}

					file.save(function(err, file) {
						if (err) {
							logger.error('[api|file:save] Error saving metadata: %s', err, {});
							logger.error('[api|file:save] Metadata: %s', require('util').inspect(metadata));
						}
						api.success(res, file.toDetailed(), 201);
					});
					// do this in the background.
					storage.postprocess(file);
				});
			});
			req.pipe(writeStream);
		});
	});
};


exports.del = function(req, res) {

	File.findOne({ id: req.params.id }, function(err, file) {
		if (err) {
			logger.error('[api|file:delete] Error getting file "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		if (!file) {
			return api.fail(res, 'No such file.', 404);
		}

		// only allow deleting own files (for now)
		if (!file._created_by.equals(req.user._id)) {
			return api.fail(res, 'Permission denied, must be owner.', 403);
		}

		// only allow inactive files (for now)
		if (file.is_active !== false) {
			return api.fail(res, 'Cannot remove active file.', 400);
		}

		file.remove(function(err) {
			if (err) {
				logger.error('[api|file:delete] Error deleting file "%s" (%s): %s', file.name, file.id, err, {});
				return api.fail(res, err, 500);
			}
			logger.info('[api|file:delete] File "%s" (%s) successfully deleted.', file.name, file.id);
			api.success(res, null, 204);

			// remove from disk (in background)
			storage.remove(file);
		});
	});
};