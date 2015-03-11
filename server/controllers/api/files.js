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
var logger = require('winston');

var api = require('./api');
var File = require('mongoose').model('File');

var storage = require('../../modules/storage');
var fileTypes = require('../../modules/filetypes');
var error = require('../../modules/error')('api', 'file');

exports.upload = function(req, res) {

	if (!req.headers['content-type']) {
		return api.fail(res, error('Header "Content-Type" must be provided.'), 422);
	}
	if (!req.headers['content-disposition']) {
		return api.fail(res, error('Header "Content-Disposition" must be provided.'), 422);
	}
	if (!/filename=([^;]+)/i.test(req.headers['content-disposition'])) {
		return api.fail(res, error('Header "Content-Disposition" must contain file name.'), 422);
	}
	if (!req.query.type) {
		return api.fail(res, error('Query parameter "type" must be provided.'), 422);
	}

	var file = new File({
		name: req.headers['content-disposition'].match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, ''),
		bytes: req.headers['content-length'],
		variations: {},
		created_at: new Date(),
		mime_type: req.headers['content-type'],
		file_type: req.query.type,
		_created_by: req.user._id
	});

	file.validate(function(err) {
		if (err) {
			return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
		}

		file.save(function(err, file) {
			/* istanbul ignore if */
			if (err) {
				return api.fail(res, error(err, 'Unable to save file'), 500);
			}

			var writeStream = fs.createWriteStream(file.getPath());
			writeStream.on('finish', function() {
				storage.metadata(file, function(err, metadata) {
					if (err) {
						return file.remove(function(err) {
							/* istanbul ignore if */
							if (err) {
								logger.error('[api|file:save] Removing file due to erroneous metadata: %s', err, {});
							}
							return api.fail(res, error('Metadata parsing for MIME type "%s" failed. Upload corrupted or weird format?', file.mime_type), 400);
						});
					}
					if (!metadata) {
						// no need to re-save
						return api.success(res, file.toDetailed(), 201);
					}

					File.sanitizeObject(metadata);
					file.metadata = metadata;

					// transform file type if transformation set
					if (fileTypes.doesTransform(file.file_type)) {
						file.file_type = fileTypes.transform(file.file_type, file.metadata);
					}

					file.save(function(err, file) {
						/* istanbul ignore if */
						if (err) {
							logger.error('[api|file:save] Error saving metadata: %s', err, {});
							logger.error('[api|file:save] Metadata: %s', require('util').inspect(metadata));
						}
						logger.info('[api|file:save] File upload of %s by <%s> successfully completed.', file.toString(), req.user.email);
						api.success(res, file.toDetailed(), 201);

						// do this in the background.
						storage.postprocess(file);
					});
				});
			});
			/* istanbul ignore next */
			writeStream.on('error', function(err) {
				return api.fail(res, error(err, 'Error saving data').log('save'), 500);
			});
			req.pipe(writeStream);
		});
	});
};


exports.del = function(req, res) {

	File.findOne({ id: req.params.id }, function(err, file) {
		/* istanbul ignore if */
		if (err) {
			return api.fail(res, error(err, 'Error getting file "%s"', req.params.id).log(), 500);
		}
		if (!file) {
			return api.fail(res, error('No such file.'), 404);
		}

		// only allow deleting own files (for now)
		if (!file._created_by.equals(req.user._id)) {
			return api.fail(res, error('Permission denied, must be owner.'), 403);
		}

		// only allow inactive files (for now)
		if (file.is_active !== false) {
			return api.fail(res, error('Cannot remove active file.'), 400);
		}

		// note: physical rm on disk is triggered by mongoose.
		file.remove(function(err) {
			/* istanbul ignore if */
			if (err) {
				return api.fail(res, error(err, 'Error deleting file "%s" at `%s`)', file.name, file.id).log('delete'), 500);
			}
			logger.info('[api|file:delete] File "%s" (%s) successfully removed.', file.name, file.id);
			api.success(res, null, 204);
		});
	});
};

exports.view = function(req, res) {

	File.findOne({ id: req.params.id }, function(err, file) {
		/* istanbul ignore if */
		if (err) {
			return api.fail(res, error(err, 'Error finding file "%s"', req.params.id).log('view'), 500);
		}
		if (!file) {
			return api.fail(res, error('No such file with ID "%s".', req.params.id), 404);
		}

		var isOwner = req.user && file._created_by.equals(req.user._id);

		if (!file.is_active && (!req.user || !isOwner)) {
			return api.fail(res, error('File "%s" is inactive.', req.params.id), req.user ? 403 : 401);
		}
		if (!file.is_public && (!req.user || !isOwner)) {
			return api.fail(res, error('File "%s" is not public.', req.params.id), req.user ? 403 : 401);
		}

		return api.success(res, file.toDetailed());
	});
};
