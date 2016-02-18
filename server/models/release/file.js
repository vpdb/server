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

const _ = require('lodash');
const mongoose = require('mongoose');
const paginate = require('mongoose-paginate');

const toObj = require('../plugins/to-object');
const fileRef = require('../plugins/file-ref');
const prettyId = require('../plugins/pretty-id');
const flavor = require('../../modules/flavor');

const Schema = mongoose.Schema;

const fields = {
	_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	flavor: {
		orientation: { type: String, 'enum': { values: flavor.keys('orientation'), message: 'Invalid orientation. Valid orientation are: ["' + flavor.keys('orientation').join('", "') + '"].' }},
		lighting:    { type: String, 'enum': { values: flavor.keys('lighting'), message: 'Invalid lighting. Valid options are: ["' + flavor.keys('lighting').join('", "') + '"].' }}
	},
	_compatibility: [ { type: Schema.ObjectId, ref: 'Build' } ],
	_media: {
		playfield_image: { type: Schema.ObjectId, ref: 'File' },
		playfield_video: { type: Schema.ObjectId, ref: 'File' }
	},
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, 'default': 0 }
	}
};

const schema = new Schema(fields);
schema.plugin(fileRef);
schema.plugin(prettyId, { model: 'ReleaseVersionFile' });
schema.plugin(toObj);

schema.options.toObject = {
	virtuals: true,
	transform: function(doc, file) {
		var Build = require('mongoose').model('Build');
		var File = require('mongoose').model('File');
		file.media = file._media;
		file.compatibility = _.map(file._compatibility, compat =>
			compat.label ? Build.toSimple(compat) : { _id: compat._id }
		);
		file.file = File.toDetailed(file._file);
		delete file.id;
		delete file._id;
		delete file._file;
		delete file._media;
		delete file._compatibility;
	}
};

module.exports.fields = fields;
module.exports.schema = schema;