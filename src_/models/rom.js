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
const logger = require('winston');
const mongoose = require('mongoose');
const paginate = require('mongoose-paginate');
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');

const prettyId = require('./plugins/pretty-id');
const gameRef = require('../../src/common/mongoose-plugins/game-ref');
const fileRef = require('./plugins/file-ref');

const Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: {
		type: String,
		required: 'ID must be provided. Use the name of the ROM file without file extension.',
		unique: true
	},
	_file: { type: Schema.ObjectId, ref: 'File', required: 'File reference must be provided.' },
	_ipdb_number: { type: Number },
	rom_files: [{
		filename: { type: String },
		bytes: { type: Number },
		crc: { type: Number },
		modified_at: { type: Date }
	}],
	version: { type: String },
	languages: { type: [String] },
	notes: { type: String },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.ObjectId, ref: 'User', required: true }
};
const RomSchema = new Schema(fields, { usePushEach: true });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
RomSchema.plugin(gameRef, { isOptional: true });
RomSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
RomSchema.plugin(prettyId, { model: 'Rom', ignore: [ '_created_by', '_game' ], validations: [
	{ path: '_file', fileType: 'rom', message: 'Must be a file of type "rom".' }
] });
RomSchema.plugin(fileRef);
RomSchema.plugin(paginate);

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
RomSchema.path('id').validate(function(id) {
	return _.isString(id) && validator.isLength(id ? id.trim() : '', 2);
}, 'ID must contain at least 2 characters.');

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
RomSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Rom', RomSchema);
logger.info('[model] Schema "Rom" registered.');