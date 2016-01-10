/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

var _ = require('lodash');
var logger = require('winston');
var Busboy = require('busboy');

var api = require('./api');
var File = require('mongoose').model('File');

var fileModule = require('../../modules/file');
var error = require('../../modules/error')('api', 'file');

exports.upload = function(req, res) {

	if (!req.headers['content-type']) {
		return api.fail(res, error('Header "Content-Type" must be provided.'), 422);
	}

	if (/multipart\/form-data/i.test(req.headers['content-type'])) {

		if (!req.query.content_type) {
			return api.fail(res, error('Mime type must be provided as query parameter "content_type" when using multipart.'), 422);
		}

		var busboy = new Busboy({ headers: req.headers });
		var files = [];
		var errors = [];
		var finished = false;

		busboy.on('file', function(fieldname, file, filename) {

			var fileData = {
				name: filename,
				bytes: 0,
				variations: {},
				created_at: new Date(),
				mime_type: req.query.content_type,
				file_type: req.query.type,
				_created_by: req.user._id
			};

			fileModule.create(fileData, file, error, function(err, f) {
				if (err) {
					return errors.push(err);
				}
				files.push(f);

				if (finished) {
					if (!_.isEmpty(errors)) {
						// return only first error
						return api.fail(res, errors[0], errors[0].code);
					}
					if (files.length > 1) {
						api.success(res, { files: _.map(files, f => f.toDetailed()) }, 201);
					} else {
						api.success(res, files[0].toDetailed(), 201);
					}
				}
			});
		});

		busboy.on('field', function(fieldname, val) {
			logger.info('[api|file:upload] Ignoring multiplart field %s: %j', fieldname, val);
		});

		busboy.on('finish', function() {
			finished = true;
		});
		req.pipe(busboy);

	} else {

		if (!req.headers['content-disposition']) {
			return api.fail(res, error('Header "Content-Disposition" must be provided.'), 422);
		}
		if (!/filename=([^;]+)/i.test(req.headers['content-disposition'])) {
			return api.fail(res, error('Header "Content-Disposition" must contain file name.'), 422);
		}
		if (!req.query.type) {
			return api.fail(res, error('Query parameter "type" must be provided.'), 422);
		}

		var fileData = {
			name: req.headers['content-disposition'].match(/filename=([^;]+)/i)[1].replace(/(^"|^'|"$|'$)/g, ''),
			bytes: req.headers['content-length'],
			variations: {},
			created_at: new Date(),
			mime_type: req.headers['content-type'],
			file_type: req.query.type,
			_created_by: req.user._id
		};

		fileModule.create(fileData, req, error, function(err, f) {
			if (err) {
				return api.fail(res, err, err.code);
			}
			api.success(res, f.toDetailed(), 201);
		});
	}
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

		// TODO check why this check is done. we're still at api level (not storage), so we should be able to query meta data of any file.
		//if (!file.is_public && (!req.user || !isOwner)) {
		//	return api.fail(res, error('File "%s" is not public.', req.params.id), req.user ? 403 : 401);
		//}

		return api.success(res, file.toDetailed());
	});
};
