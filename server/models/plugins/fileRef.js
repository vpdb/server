/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var _ = require('underscore');
var async = require('async');
var logger = require('winston');
var mongoose = require('mongoose');
var objectPath = require('object-path');

var storage = require('../../modules/storage');

module.exports = exports = function(schema, options) {

	/* istanbul ignore if */
	if (!options || !options.model) {
		throw new Error('Fileref plugin needs model. Please provide.');
	}
	/* istanbul ignore if */
	if (!options.fields || !_.isArray(options.fields)) {
		throw new Error('Fileref plugin needs file reference fields. Please provide.');
	}

	/**
	 * Replaces API IDs with database IDs and returns a new instance of the
	 * configured model.
	 *
	 * @param obj Object, directly from API client
	 * @param callback Called with (`err`, `ModelInstance`)
	 */
	schema.statics.getInstance = function(obj, callback) {

		var Model = mongoose.model(options.model);
		var File = mongoose.model('File');

		var shortIds = [];
		_.each(options.fields, function(path) {
			var shortId = objectPath.get(obj, path);
			if (shortId) {
				shortIds.push(shortId);
			}
		});
		var invalidations = [];

		// find files with submitted shortIds
		File.find({ id: { $in: shortIds }}, function(err, files) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return callback(err);
			}
			_.each(options.fields, function(path) {
				var hit = false;
				var shortId = objectPath.get(obj, path);
				_.each(files, function(file) {

					// if match, switch shortId with _id
					if (file.id === shortId) {
						objectPath.set(obj, path, file._id);
						hit = true;
					}
				});
				// no match, add invalidation
				if (!hit) {
					if (shortId) {
						var value = objectPath.get(obj, path);
						logger.warn('[model] File ID %s not found in database for field %s.', value, path);
						invalidations.push({ path: path, message: 'No such file with ID "' + value + '".', value: value });
						objectPath.set(obj, path, '000000000000000000000000');
					}
				}
			});
			var model = new Model(obj);

			// for invalid IDs, invalidate instantly so we can provide which value is wrong.
			_.each(invalidations, function(invalidation) {
				model.invalidate(invalidation.path, invalidation.message, invalidation.value);
			});
			callback(null, model);
		});
	};


	//-----------------------------------------------------------------------------
	// VALIDATIONS
	//-----------------------------------------------------------------------------
	_.each(options.fields, function(path) {

		schema.path(path).validate(function(fileId, callback) {
			var referer = this;
			if (!fileId || !referer._created_by) {
				return callback(true);
			}
			mongoose.model('File').findOne({ _id: fileId }, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.error('[model] Error fetching file "%s".', fileId);
					return callback(true);
				}
				if (!file) {
					return callback(true);
				}

				// let's invalidate manually because we want to provide `id` instead of `_id` as value
				if (!file._created_by.equals(referer._created_by)) {
					referer.invalidate(path, 'Referenced file must be of the same owner as referer.', file.id);
				}
				if (referer.isNew && file.is_active) {
					referer.invalidate(path, 'Cannot reference active files. If a file is active that means that is has been referenced elsewhere, in which case you cannot reference it again.', file.id);
				}
				callback(true);
			});
		});
	});


	/**
	 * Sets the referenced files to active. Call this after creating a new
	 * instance.
	 *
	 * @param done (`err`)
	 * @returns {*}
	 */
	schema.methods.activateFiles = function(done) {

		var File = mongoose.model('File');

		var ids = [];
		var obj = this;
		_.each(options.fields, function(path) {
			var id = objectPath.get(obj, path);
			if (id) {
				ids.push(id);
			}
		});
		File.find({ _id: { $in: ids }}, function(err, files) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return done(err);
			}

			// update
			async.each(files, function(file, next) {
				file.is_active = true;
				file.save(next);
			}, function(err) {
				/* istanbul ignore if */
				if (err) {
					return done(err);
				}
				obj.populate(options.fields.join(' '), done);
			});
		});
		return this;
	};

	/**
	 * Remove file references from database
	 */
	schema.post('remove', function(obj, done) {

		var File = mongoose.model('File');

		var ids = [];
		_.each(options.fields, function(path) {
			var id = objectPath.get(obj, path);
			if (id) {
				ids.push(id);
			}
		});
		File.find({ _id: { $in: ids }}, function(err, files) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return done(err);
			}
			// remove file references from db
			async.each(files, function(file, next) {
				file.remove(next);
			}, done);
		});
	});
};
