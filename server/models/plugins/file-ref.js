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
var async = require('async');
var logger = require('winston');
var mongoose = require('mongoose');

var common = require('./common');
var error = require('../../modules/error')('model', 'file-ref');

//noinspection JSUnresolvedVariable
module.exports = function(schema, options) {

	options = options || {};

	// filter ignored paths
	var paths = _.pickBy(common.traversePaths(schema), function(schemaType) {
		return schemaType.options && schemaType.options.ref && schemaType.options.ref === 'File';
	});
	var fileRefs = _.omitBy(paths, function(schemaType, path) {
		return _.includes(options.ignore, path);
	});

	//-----------------------------------------------------------------------------
	// VALIDATIONS
	//-----------------------------------------------------------------------------
	_.keys(fileRefs).forEach(function(path) {

		schema.path(path).validate(function(fileId, callback) {
			var that = this;
			if (!fileId || !that._created_by) {
				return callback(true);
			}

			mongoose.model('File').findOne({ _id: fileId._id || fileId.toString() }, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.error('[model] Error fetching file "%s".', fileId);
					return callback(true);
				}
				// this is already checked by pretty-id
				if (!file) {
					return callback(true);
				}

				/* removed: e.g. a backglass can be updated by someone different than the original game creator.
				let thisCreatedBy = that._created_by._id || that._created_by;
				if (!file._created_by.equals(thisCreatedBy)) {
					that.invalidate(path, 'Referenced file ' + file.id + ' must be of the same owner as referer ' + thisCreatedBy.toString() + '.', file.id);
				}*/

				if (that.isNew && file.is_active) {
					that.invalidate(path, 'Cannot reference active files. If a file is active that means that is has been referenced elsewhere, in which case you cannot reference it again.', file.id);
				}
				callback(true);
			});
		});
	});

	/**
	 * Sets the referenced files to active. Call this after creating a new
	 * instance.
	 *
	 * Note that only inactive files are activated, already activated files
	 * are ignored.
	 *
	 * @returns {Promise.<String[]>} File IDs that have been activated.
	 */
	schema.methods.activateFiles = function() {

		const File = mongoose.model('File');
		let ids = [];
		let activatedIds = [];

		let objPaths = _.keys(common.explodePaths(this, fileRefs));
		objPaths.forEach(path => {
			let id = _.get(this, path);
			if (id) {
				ids.push(id._id || id);
			}
		});

		return Promise.try(() => {
			return File.find({ _id: { $in: ids }, is_active: false });

		}).then(files => {
			activatedIds = _.map(files, 'id');
			return Promise.each(files, file => file.switchToActive());

		}).then(() => {
			return this.populate(objPaths.join(' ')).execPopulate();

		}).then(() => {
			return activatedIds;
		});
	};

	/**
	 * Remove file references from database
	 */
	schema.post('remove', function(obj, done) {

		var File = mongoose.model('File');
		var objPaths = _.keys(common.explodePaths(obj, fileRefs));
		var ids = [];
		objPaths.forEach(function(path) {
			var id = _.get(obj, path + '._id');
			if (id) {
				ids.push(id);
			}
		});
		File.find({ _id: { $in: ids }}, function(err, files) {
			/* istanbul ignore if */
			if (err) {
				return done(error(err, 'Error finding referenced files').log());
			}
			// remove file references from db
			async.each(files, function(file, next) {
				file.remove(next);
			}, done);
		});
	});
};
