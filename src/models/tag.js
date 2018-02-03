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

const Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	_id: { type: String, required: true, unique: true },
	name: { type: String, required: 'Name must be provided.', unique: true },
	description: { type: String, required: 'Description must be provided.' },
	is_active: { type: Boolean, required: true, default: false },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.ObjectId, ref: 'User', required: true }
};
const TagSchema = new Schema(fields, { usePushEach: true });


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
TagSchema.virtual('id')
	.get(function() {
		return this._id;
	});


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TagSchema.path('name').validate(function(name) {
	return _.isString(name) && validator.isLength(name ? name.trim() : '', 2);
}, 'Name must contain at least two characters.');

TagSchema.path('name').validate(function(name, done) {
	mongoose.model('Tag').findOne({ name: name }, function(err, tag) {
		/* istanbul ignore if */
		if (err) {
			logger.error('Error checking for unique tag name: %s', err.message);
		}
		done(!err && !tag);
	});
}, 'The {PATH} "{VALUE}" is already taken.');

TagSchema.path('description').validate(function(description) {
	return _.isString(description) && validator.isLength(description ? description.trim() : description, 5);
}, 'Name must contain at least 5 characters.');


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
TagSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('Tag', TagSchema);
logger.info('[model] Schema "Tag" registered.');