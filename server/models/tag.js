/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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
var toObj = require('./plugins/to-object');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	_id:          { type: String, required: true, unique: true },
	name:         { type: String, required: 'Name must be provided.', unique: true },
	description:  { type: String, required: 'Description must be provided.' },
	is_active:    { type: Boolean, required: true, default: false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User', required: true }
};
var TagSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
TagSchema.plugin(toObj);


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
TagSchema.virtual('id')
	.get(function() {
		return this._id;
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
TagSchema.methods.toSimple = function() {
	return _.pick(this.obj(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TagSchema.path('name').validate(function(name) {
	return validator.isLength(name ? name.trim() : '', 2);
}, 'Name must contain at least two characters.');

TagSchema.path('name').validate(function(name, done) {
	mongoose.model('Tag').findOne({ name: name }, function(err, tag) {
		if (err) {
			logger.error('Error checking for unique tag name: %s', err.message);
		}
		done(!err && !tag);
	});
}, 'The {PATH} "{VALUE}" is already taken.');

TagSchema.path('description').validate(function(description) {
	return validator.isLength(description ? description.trim() : description, 5);
}, 'Name must contain at least 5 characters.');


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
TagSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, tag) {
		delete tag.__v;
		delete tag._id;
		delete tag._created_by;
		delete tag.is_active;
	}
};

mongoose.model('Tag', TagSchema);
logger.info('[model] Schema "Tag" registered.');