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

const mongoose = require('mongoose');

const fileRef = require('../plugins/file-ref');
const prettyId = require('../plugins/pretty-id');
const flavor = require('../../../src/releases/release.flavors');

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

const schema = new Schema(fields, { usePushEach: true });
schema.plugin(fileRef);
schema.plugin(prettyId, { model: 'ReleaseVersionFile' });

schema.options.toObject = { virtuals: true, versionKey: false };

module.exports.fields = fields;
module.exports.schema = schema;