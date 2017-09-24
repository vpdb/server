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
var crypto = require('crypto');
var logger = require('winston');
var shortId = require('shortid32');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var toObj = require('./plugins/to-object');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true, 'default': shortId.generate },
	token:        { type: String, required: true, unique: true, 'default': generate },
	label:        { type: String, required: 'A label must be provided.' },
	type:         { type: String,  'enum': [ 'access', 'login' ] },
	is_active:    { type: Boolean, required: true, 'default': true },
	last_used_at: { type: Date },
	expires_at:   { type: Date, required: true },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User', required: true }
};
var TokenSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'label', 'is_active', 'last_used_at', 'expires_at', 'created_at' ]
};


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
TokenSchema.methods.toSimple = function(showToken) {
	var obj = TokenSchema.statics.toSimple(this);
	if (showToken) {
		obj.token = this.token;
	}
	return obj;
};

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
TokenSchema.statics.toSimple = function(token) {
	var obj = token.toObj ? token.toObj() : token;
	return _.pick(obj, apiFields.simple);
};

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TokenSchema.path('label').validate(function(label) {
	return _.isString(label) && validator.isLength(label ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
TokenSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
TokenSchema.plugin(toObj);


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
TokenSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, build) {
		delete build.__v;
		delete build._id;
		delete build._created_by;
	}
};

/**
 * Generates a token.
 * @returns {string} token
 */
function generate() {
	return crypto.randomBytes(16).toString('hex');
}

mongoose.model('Token', TokenSchema);
logger.info('[model] Schema "Token" registered.');