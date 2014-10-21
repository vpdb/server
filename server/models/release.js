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

var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var fileRef = require('../models/plugins/fileRef');

var Schema = mongoose.Schema;

//var maxAspectRatioDifference = 0.2;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true, 'default': shortId.generate },
	name:         { type: String, required: 'Name must be provided.' },
	description:  { type: String },
	versions: [ {
		version: { type: String, required: 'Version must be provided.' },
		changes: { type: String },
		files: [ {
			_file:  { type: Schema.ObjectId, required: true, ref: 'File' },
			flavor: {
				orientation: { type: String, required: true, enum: { values: [ 'ws', 'fs' ], message: 'Invalid orientation. Valid orientation are: ["ws", "fs"].' }},
				lightning:   { type: String, required: true, enum: { values: [ 'day', 'night' ], message: 'Invalid lightning. Valid options are: ["day", "night"].' }}
			},
			compatibility: [ { type: Schema.ObjectId, ref: 'VPBuild' } ],
			_media: {
				playfield_image: { type: Schema.ObjectId, ref: 'File', required: 'Playfield image must be provided.' },
				playfield_video: { type: Schema.ObjectId, ref: 'File' }
			}
		} ]
	} ],
	authors: [ {
		_user: { type: Schema.ObjectId, required: true, ref: 'User' },
		roles: [ String ]
	} ],
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
