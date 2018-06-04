/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { isString } from 'lodash';
import { GameReferenceModel, PaginateModel, PrettyIdModel, Schema } from 'mongoose';
import paginatePlugin = require('mongoose-paginate');
import uniqueValidator from 'mongoose-unique-validator';

import { prettyIdPlugin } from '../common/mongoose/pretty.id.plugin';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';
import { gameReferencePlugin } from '../common/mongoose/game.reference.plugin';
import { Rom } from './rom';

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const romFields = {
	id: {
		type: String,
		required: 'ID must be provided. Use the name of the ROM file without file extension.',
		unique: true
	},
	_file: { type: Schema.Types.ObjectId, ref: 'File', required: 'File reference must be provided.' },
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
	_created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true }
};
export interface RomModel extends PrettyIdModel<Rom>, PaginateModel<Rom>, GameReferenceModel<Rom> {}
export const romSchema = new Schema(romFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
romSchema.plugin(gameReferencePlugin, { isOptional: true });
romSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.', code: 'duplicate_field' });
romSchema.plugin(prettyIdPlugin, { model: 'Rom', ignore: [ '_created_by', '_game' ], validations: [
	{ path: '_file', fileType: 'rom', message: 'Must be a file of type "rom".' }
] });
romSchema.plugin(fileReferencePlugin);
romSchema.plugin(paginatePlugin);

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
romSchema.path('id').validate((id:any) => {
	return isString(id) && validator.isLength(id ? id.trim() : '', 2);
}, 'ID must contain at least 2 characters.');
