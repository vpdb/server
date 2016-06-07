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
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');
const paginate = require('mongoose-paginate');
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');

const prettyId = require('./plugins/pretty-id');
const fileRef = require('./plugins/file-ref');
const toObj = require('./plugins/to-object');

const author = require('./release/author');

const Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const versionFields = {
	version: { type: String, required: 'Version must be provided.' },
	changes: { type: String },
	_file:  { type: Schema.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, 'default': 0 }
	}
};
const VersionSchema = new Schema(versionFields);

const backglassFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	_game:         { type: Schema.ObjectId, ref: 'Game', required: true },
	versions:      { type: [ VersionSchema ], validate: [ nonEmptyArray, 'You must provide at least one version for the backglass.' ] },
	description:   { type: String },
	authors:       { type: [ author.schema ], validate: [ nonEmptyArray, 'You must provide at least one author.' ] },
	acknowledgements: { type: String },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User', required: true }
};
const BackglassSchema = new Schema(backglassFields);

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
const apiFields = {
	simple: [ 'id', 'versions', 'description', 'authors', 'acknowledgements', 'created_at' ]
};

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
BackglassSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
BackglassSchema.plugin(prettyId, { model: 'Backglass', ignore: [ '_created_by' ], validations: [
	{ path: '_file', mimeType: 'application/x-directb2s', message: 'Must be a .directb2s file.' },
	{ path: '_file', fileType: 'backglass', message: 'Must be a file of type "backglass".' }
] });
BackglassSchema.plugin(fileRef);
BackglassSchema.plugin(paginate);
BackglassSchema.plugin(toObj);

VersionSchema.plugin(fileRef);
VersionSchema.plugin(toObj);

//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
BackglassSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});
VersionSchema.virtual('file')
	.get(function() {
		if (this._file && this.populated('_file')) {
			return this._file.toSimple();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
BackglassSchema.methods.toSimple = function() {
	return _.pick(this.toObj(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
BackglassSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, rom) {
		delete rom.__v;
		delete rom._id;
		delete rom._created_by;
	}
};

mongoose.model('Backglass', BackglassSchema);
logger.info('[model] Schema "Backglass" registered.');