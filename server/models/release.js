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

var _ = require('lodash');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var fileRef = require('../models/plugins/fileRef');
var mimetypes = require('../modules/mimetypes');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true, 'default': shortId.generate },
	name:         { type: String, required: 'Name must be provided.' },
	description:  { type: String },
	versions: { validate: [ nonEmptyArray, 'You must provide at least one version for the release.' ], type: [ {
		version: { type: String, required: 'Version must be provided.' },
		changes: { type: String },
		files: { validate: [ containsVpTable, 'You must reference at least one VPT/VPX file.' ], type: [ {
			_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
			flavor: {
				orientation: { type: String, enum: { values: [ 'ws', 'fs' ], message: 'Invalid orientation. Valid orientation are: ["ws", "fs"].' }},
				lightning:   { type: String, enum: { values: [ 'day', 'night' ], message: 'Invalid lightning. Valid options are: ["day", "night"].' }}
			},
			compatibility: [ { type: Schema.ObjectId, ref: 'VPBuild' } ],
			_media: {
				playfield_image: { type: Schema.ObjectId, ref: 'File' },
				playfield_video: { type: Schema.ObjectId, ref: 'File' }
			}
		} ] }
	} ] },
	authors: { validate: [ nonEmptyArray, 'You must provide at least one author.' ], type: [ {
		_user: { type: String, required: 'Reference to user must be provided.', ref: 'User' },
		roles: [ String ]
	} ] },
	_tags: [ { type: Schema.ObjectId, required: true, ref: 'Tag' } ],
	links: [ {
		label: { type: String },
		url: { type: String }
	} ],
	acknowledgements: { type: String },
	original_version: {
		_ref: { type: Schema.ObjectId, ref: 'Release' },
		release: {
			name: { type: String },
			url: { type: String }
		}
	},
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, required: true, ref: 'User' }
};

var ReleaseSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
ReleaseSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
ReleaseSchema.plugin(fileRef, { model: 'Release', fields: [
	'versions.0.files.0._file',
	'versions.0.files.0._media.playfield_image',
	'versions.0.files.0._media.playfield_video'
]});


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

function containsVpTable(files) {
	if (!_.isArray(files) || files.length === 0) {
		return false;
	}
}

ReleaseSchema.path('versions.0').validate(function(file, callback) {
	var that = this;

	var ids = _.pluck(_.flatten(_.pluck(that.versions, 'files')), '_file');

	mongoose.model('File').find({ _id: { $in: ids }}, function(err, files) {
		/* istanbul ignore if */
		if (err) {
			logger.error('[model] Error fetching files [ %s ].', that.ids);
			return callback(true);
		}

		// validate that every version has a table file
		_.each(that.versions, function(version, i) {

			var versionIds = _.pluck(version.files, '_file');
			var versionFiles = _.map(versionIds, function(id) {
				return _.find(files, { _id: id });
			});

			var tableFiles = _.filter(versionFiles, function(file) {
				return file.getMimeCategory() === 'table';
			});

			if (tableFiles.length === 0) {
				that.invalidate('versions.' + i + '.files', 'At least one table file must be provided.');
			}
		});

		// validate that files are not referenced more than once
		if (_.uniq(ids).length !== ids.length) {
			that.invalidate('versions', 'You cannot reference a file multiple times.');
		}

		callback(true);
	});
});

ReleaseSchema.path('versions.0.files.0._file').validate(function(file, callback) {
	var that = this;
	if (that._file) {

		mongoose.model('File').findOne({ _id: that._file }, function(err, file) {
			/* istanbul ignore if */
			if (err) {
				logger.error('[model] Error fetching file "%s".', that._file);
				return callback(true);
			}
			if (!file) {
				// this is already validated by the file reference
				return callback(true);
			}

			// table checks
			if (file.getMimeCategory() === 'table') {

				// flavor
				that.flavor = that.flavor || {};
				_.each(fields.versions.type[0].files.type[0].flavor, function(obj, flavor) {

					if (!that.flavor[flavor]) {
						that.invalidate('flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
					}
				});

				// media
				if (!that._media || !that._media.playfield_image) {
					that.invalidate('_media.playfield_image', 'Playfield image must be provided.');
				}
			}
			callback(true);
		});
	}
});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
ReleaseSchema.methods.toDetailed = function() {
	return this.toObject();
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
ReleaseSchema.set('toObject', { virtuals: true });
if (!ReleaseSchema.options.toObject) {
	ReleaseSchema.options.toObject = {};
}
ReleaseSchema.options.toObject.transform = function(doc, release) {
	delete release.__v;
	delete release._id;
};

mongoose.model('Release', ReleaseSchema);
logger.info('[model] Model "release" registered.');
