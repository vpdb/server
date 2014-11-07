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
var async = require('async');
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
	_game:        { type: String, required: 'Reference to game must be provided.', ref: 'Game' },
	name:         { type: String, required: 'Name must be provided.' },
	description:  { type: String },
	versions: { validate: [ nonEmptyArray, 'You must provide at least one version for the release.' ], type: [ {
		version: { type: String, required: 'Version must be provided.' },
		changes: { type: String },
		files: { validate: [ nonEmptyArray, 'You must provide at least one file.' ], type: [ {
			_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
			flavor: {
				orientation: { type: String, enum: { values: [ 'ws', 'fs' ], message: 'Invalid orientation. Valid orientation are: ["ws", "fs"].' }},
				lightning:   { type: String, enum: { values: [ 'day', 'night' ], message: 'Invalid lightning. Valid options are: ["day", "night"].' }}
			},
			_compatibility: [ { type: String, ref: 'VPBuild' } ],
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
	_tags: [ { type: Schema.ObjectId, ref: 'Tag' } ],
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

ReleaseSchema.path('versions').validate(function(file) {
	var ids = _.compact(_.pluck(_.flatten(_.pluck(this.versions, 'files')), '_file'));
	if (_.uniq(ids).length !== ids.length) {
		this.invalidate('versions', 'You cannot reference a file multiple times.');
	}
	return true;
});

ReleaseSchema.path('versions.0.files').validate(function(files, callback) {

	var i = 0;
	var that = this;
	if (!_.isArray(files) || files.length === 0) {
		return callback(true);
	}
	var hasTableFile = false;
	async.eachSeries(files, function(f, next) {
		if (f._file) {

			mongoose.model('File').findById(f._file, function(err, file) {
				/* istanbul ignore if */
				if (err) {
					logger.error('[model] Error fetching file "%s".', f._file);
					return next();
				}
				if (!file) {
					// this is already validated by the file reference
					return next();
				}

				// table checks
				if (file.getMimeCategory() === 'table') {

					hasTableFile = true;

					// flavor
					f.flavor = f.flavor || {};
					_.each(fields.versions.type[0].files.type[0].flavor, function(obj, flavor) {
						if (!f.flavor[flavor]) {
							that.invalidate('files.' + i + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
						}
					});

					// media
					if (!f._media || !f._media.playfield_image) {
						that.invalidate('files.' + i + '._media.playfield_image', 'Playfield image must be provided.');
					}

					// compatibility (in here because it applies only to table files.)
					if (!_.isArray(f._compatibility) || !f._compatibility.length) {
						that.invalidate('files.' + i + '._compatibility', 'At least one VP build must be provided.');
						i++;
						next();
					} else {

						var j = 0;
						async.eachSeries(f._compatibility, function(vpbuildId, nxt) {
							mongoose.model('VPBuild').findOne({ id: vpbuildId }, function(err, vpbuild) {
								/* istanbul ignore if */
								if (err) {
									logger.error('[model] Error fetching VPBuild "%s".', vpbuildId);
									return next();
								}
								if (!vpbuild) {
									that.invalidate('files.' + i + '._compatibility.' + j, 'No such VP build with ID "' + vpbuildId + '".');
								}
								j++;
								nxt();
							});
						}, function() {
							i++;
							next();
						});
					}
				} else {
					i++;
					next();
				}

			});
		} else {
			next();
		}
	}, function() {
		if (!hasTableFile) {
			that.invalidate('files', 'At least one table file must be provided.');
		}
		callback(true);
	});
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
