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
var types =  [ 'release', 'nightly', 'experimental' ];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true },
	label:        { type: String, required: 'A label must be provided.', unique: true },
	download_url: { type: String },
	support_url:  { type: String },
	description:  { type: String },
	built_at:     { type: Date },
	type:         { type: String, required: 'The type of the VP build must be provided.', enum: { values: types, message: 'Invalid type. Valid types are: [ "' + types.join('", "') + '" ].' }},
	is_range:     { type: Boolean, required: 'You need to provide if the build is a range of versions or one specific version.', default: false },
	is_active:    { type: Boolean, required: true, default: false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User' }
};
var VPBuildSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'label', 'download_url', 'description', 'built_at', 'type', 'is_range' ]
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
VPBuildSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
VPBuildSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
VPBuildSchema.path('label').validate(function(label) {
	return validator.isLength(label ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');

VPBuildSchema.path('built_at').validate(function(dateString) {
	// TODO fix, doesn't seem to work.
	//console.log('--------------- Checking date "%s": %s', dateString, validator.isDate(dateString));
	return validator.isDate(dateString);
}, 'Date must be a string parseable by Javascript.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
VPBuildSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
if (!VPBuildSchema.options.toObject) {
	VPBuildSchema.options.toObject = {};
}
VPBuildSchema.options.toObject.transform = function(doc, vpbuild) {
	delete vpbuild.__v;
	delete vpbuild._id;
	delete vpbuild._created_by;
};

mongoose.model('VPBuild', VPBuildSchema);
logger.info('[model] Schema "VPBuild" registered.');