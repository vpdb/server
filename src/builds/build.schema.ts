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

import { Schema } from 'mongoose';
import { isString, isDate } from 'lodash';
import validator from 'validator';
import uniqueValidator from 'mongoose-unique-validator';

export const platforms = ['vp'];
export const types = ['release', 'nightly', 'experimental'];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const buildFields = {
	id: { type: String, required: true, unique: true },
	platform: {
		type: String,
		required: 'The platform must be provided.',
		'enum': {
			values: platforms,
			message: 'Invalid platform. Valid platforms are: [ "' + platforms.join('", "') + '" ].'
		}
	},
	label: { type: String, required: 'A label must be provided.', unique: true },
	major_version: { type: String, required: 'Major version must be provided.' },
	download_url: { type: String },
	support_url: { type: String },
	description: { type: String },
	built_at: { type: Date },
	type: {
		type: String,
		required: 'The type of the build must be provided.',
		'enum': { values: types, message: 'Invalid type. Valid types are: [ "' + types.join('", "') + '" ].' }
	},
	is_range: {
		type: Boolean,
		required: 'You need to provide if the build is a range of versions or one specific version.',
		default: false
	},
	is_active: { type: Boolean, required: true, default: false },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true }
};
export const buildSchema = new Schema(buildFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
buildSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
buildSchema.path('label').validate((label: any) => {
	return validator.isLength(isString(label) ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');

buildSchema.path('built_at').validate((dateString: any) => {
	return isDate(dateString) || (isString(dateString) && validator.isISO8601(dateString));
}, 'Date must be a string parsable by Javascript.');
