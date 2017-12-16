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

var _ = require('lodash');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var toObj = require('./plugins/to-object');

var Schema = mongoose.Schema;
var platforms = [ 'vp' ];
var types = [ 'release', 'nightly', 'experimental' ];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:            { type: String, required: true, unique: true },
	platform:      { type: String, required: 'The platform must be provided.', 'enum': { values: platforms, message: 'Invalid platform. Valid platforms are: [ "' + platforms.join('", "') + '" ].' } },
	label:         { type: String, required: 'A label must be provided.', unique: true },
	major_version: { type: String, required: 'Major version must be provided.' },
	download_url:  { type: String },
	support_url:   { type: String },
	description:   { type: String },
	built_at:      { type: Date },
	type:          { type: String, required: 'The type of the build must be provided.', 'enum': { values: types, message: 'Invalid type. Valid types are: [ "' + types.join('", "') + '" ].' } },
	is_range:      { type: Boolean, required: 'You need to provide if the build is a range of versions or one specific version.', default: false },
	is_active:     { type: Boolean, required: true, default: false },
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.ObjectId, ref: 'User', required: true }
};
var BuildSchema = new Schema(fields, { usePushEach: true });


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'label', 'platform', 'major_version', 'download_url', 'built_at', 'type', 'is_range' ],
	detailed: [ 'support_url', 'description', 'is_active' ]
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
BuildSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
BuildSchema.methods.toSimple = function() {
	return BuildSchema.statics.toSimple(this);
};

BuildSchema.methods.toDetailed = function() {
	return BuildSchema.statics.toDetailed(this);
};

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
BuildSchema.statics.toSimple = function(build) {
	var obj = build.toObj ? build.toObj() : build;
	return _.pick(obj, apiFields.simple);
};
BuildSchema.statics.toDetailed = function(build) {
	var obj = build.toObj ? build.toObj() : build;
	return _.pick(obj, [ ...apiFields.simple, ...apiFields.detailed ]);
};

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
BuildSchema.path('label').validate(function(label) {
	return validator.isLength(_.isString(label) ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');

BuildSchema.path('built_at').validate(function(dateString) {
	return _.isDate(dateString) || (_.isString(dateString) && validator.isISO8601(dateString));
}, 'Date must be a string parseable by Javascript.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
BuildSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
BuildSchema.plugin(toObj);


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
BuildSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, build) {
		delete build.__v;
		delete build._id;
		delete build._created_by;
	}
};

mongoose.model('Build', BuildSchema);
logger.info('[model] Schema "Build" registered.');