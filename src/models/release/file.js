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

'use strict';

const _ = require('lodash');
const mongoose = require('mongoose');

const toObj = require('../plugins/to-object');
const fileRef = require('../plugins/file-ref');
const prettyId = require('../plugins/pretty-id');
const flavor = require('../../modules/flavor');

const Schema = mongoose.Schema;
const validationStatusValues = ['verified', 'playable', 'broken'];

const fields = {
	_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	flavor: {
		orientation: { type: String, 'enum': { values: flavor.keys('orientation'), message: 'Invalid orientation. Valid orientation are: ["' + flavor.keys('orientation').join('", "') + '"].' }},
		lighting:    { type: String, 'enum': { values: flavor.keys('lighting'), message: 'Invalid lighting. Valid options are: ["' + flavor.keys('lighting').join('", "') + '"].' }}
	},
	validation: {
		status:  { type: String, 'enum': { values: validationStatusValues, message: 'Invalid status, must be one of: ["' + validationStatusValues.join('", "') + '"].' }},
		message: { type: String },
		validated_at:    { type: Date },
		_validated_by:   { type: Schema.ObjectId, ref: 'User' }
	},
	_compatibility: [ { type: Schema.ObjectId, ref: 'Build' } ],
	_playfield_image: { type: Schema.ObjectId, ref: 'File' },
	_playfield_video: { type: Schema.ObjectId, ref: 'File' },
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, 'default': 0 }
	}
};

const schema = new Schema(fields);
schema.plugin(fileRef);
schema.plugin(prettyId, { model: 'ReleaseVersionFile' });
schema.plugin(toObj);


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
// schema.virtual('validation.validated_by')
// 	.get(function() {
// 		if (this.populated('validation._validated_by')) {
// 			return this.validation._validated_by.toReduced();
// 		}
// 	});

schema.options.toObject = {
	virtuals: true,
	transform: function(doc, file) {
		const Build = require('mongoose').model('Build');
		const File = require('mongoose').model('File');
		const User = require('mongoose').model('User');
		file.playfield_image = file._playfield_image;
		file.playfield_video = file._playfield_video;
		file.compatibility = _.map(file._compatibility, compat =>
			compat.label ? Build.toSimple(compat) : { _id: compat._id }
		);
		file.file = File.toDetailed(file._file);
		if (file.validation) {
			if (file.validation._validated_by.id) {
				file.validation.validated_by = User.toReduced(file.validation._validated_by);
			}
			delete file.validation._validated_by;
		}
		delete file.id;
		delete file._id;
		delete file._file;
		delete file._playfield_image;
		delete file._playfield_video;
		delete file._compatibility;
	}
};

module.exports.fields = fields;
module.exports.schema = schema;