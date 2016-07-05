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
var mongoose = require('mongoose');
var paginate = require('mongoose-paginate');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var prettyId = require('./plugins/pretty-id');
var fileRef = require('./plugins/file-ref');
var toObj = require('./plugins/to-object');
var moderate = require('./plugins/moderate');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: 'ID must be provided. Use the name of the ROM file without file extension.', unique: true },
	_file:        { type: Schema.ObjectId, ref: 'File', required: 'File reference must be provided.' },
	_game:        { type: Schema.ObjectId },
	_ipdb_number: { type: Number },
	rom_files: [ {
		filename:     { type: String },
		bytes:        { type: Number },
		crc:          { type: Number },
		modified_at:  { type: Date }
	} ],
	version:      { type: String },
	languages:    { type: [ String ] },
	notes:        { type: String },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User', required: true }
};
var RomSchema = new Schema(fields);

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'file', 'version', 'notes', 'languages', 'rom_files', 'created_by' ]
};

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
RomSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
RomSchema.plugin(prettyId, { model: 'Rom', ignore: [ '_created_by', '_game' ], validations: [
	{ path: '_file', mimeType: 'application/zip', message: 'Must be a ZIP archive.' },
	{ path: '_file', fileType: 'rom', message: 'Must be a file of type "rom".' }
] });
RomSchema.plugin(fileRef);
RomSchema.plugin(paginate);
RomSchema.plugin(moderate);
RomSchema.plugin(toObj);

//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
RomSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});

RomSchema.virtual('file')
	.get(function() {
		if (this._file && this.populated('_file')) {
			return this._file.toSimple();
		}
	});

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
RomSchema.methods.toSimple = function() {
	return _.pick(this.toObj(), apiFields.simple);
};

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
RomSchema.path('id').validate(function(id) {
	return _.isString(id) && validator.isLength(id ? id.trim() : '', 2);
}, 'ID must contain at least 2 characters.');

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
RomSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, rom) {
		delete rom.__v;
		delete rom._id;
		delete rom._created_by;
		if (_.isArray(rom.rom_files)) {
			rom.rom_files.forEach(rom => {
				delete rom._id;
				delete rom.id;
			});
		}
	}
};

mongoose.model('Rom', RomSchema);
logger.info('[model] Schema "Rom" registered.');