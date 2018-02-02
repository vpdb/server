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
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');

const Schema = mongoose.Schema;
const platforms = ['vp'];
const types = ['release', 'nightly', 'experimental'];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
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
	_created_by: { type: Schema.ObjectId, ref: 'User', required: true }
};
const BuildSchema = new Schema(fields, { usePushEach: true });

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
BuildSchema.path('label').validate(function(label) {
	return validator.isLength(_.isString(label) ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');

BuildSchema.path('built_at').validate(function(dateString) {
	return _.isDate(dateString) || (_.isString(dateString) && validator.isISO8601(dateString));
}, 'Date must be a string parsable by Javascript.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
BuildSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
BuildSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Build', BuildSchema);
logger.info('[model] Schema "Build" registered.');