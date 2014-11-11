/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true },
	name:         { type: String, required: 'Name must be provided.', unique: true },
	description:  { type: String, required: 'Description must be provided.' },
	is_active:    { type: Boolean, required: true, default: false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User' },
	_releases:    [ { type: Schema.ObjectId, ref: 'Release' } ]
};
var TagSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'name', 'description' ]
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
TagSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
TagSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TagSchema.path('name').validate(function(name) {
	return validator.isLength(name ? name.trim() : '', 2);
}, 'Name must contain at least two characters.');

TagSchema.path('description').validate(function(description) {
	return validator.isLength(description ? description.trim() : description, 5);
}, 'Name must contain at least 5 characters.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
TagSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
if (!TagSchema.options.toObject) {
	TagSchema.options.toObject = {};
}
TagSchema.options.toObject.transform = function(doc, tag) {
	delete tag.__v;
	delete tag._id;
	delete tag._created_by;
	delete tag._releases;
};

mongoose.model('Tag', TagSchema);
logger.info('[model] Schema "Tag" registered.');