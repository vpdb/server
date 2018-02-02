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
const crypto = require('crypto');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');
const validator = require('validator');
const uniqueValidator = require('mongoose-unique-validator');
const userAgentParser = require('ua-parser-js');

const scope = require('../scope');
const config = require('../modules/settings').current;

const Schema = mongoose.Schema;
const validTypes = [ 'personal', 'application' ];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	token: { type: String, required: true, unique: true, 'default': generate },
	label: { type: String, required: 'A label must be provided' },
	type: { type: String, 'enum': validTypes, required: true },
	scopes: { type: [String] },
	provider: { type: String }, // must be set for application tokens
	is_active: { type: Boolean, required: true, 'default': true },
	last_used_at: { type: Date },
	expires_at: { type: Date, required: true },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.ObjectId, ref: 'User', required: true }
};
const TokenSchema = new Schema(fields, { usePushEach: true });

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
const apiFields = {
	simple: ['id', 'label', 'type', 'scopes', 'provider', 'is_active', 'last_used_at', 'expires_at', 'created_at']
};

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
TokenSchema.methods.toSimple = function(showToken) {
	const obj = TokenSchema.statics.toSimple(this);
	if (showToken) {
		obj.token = this.token;
	}
	const browser = userAgentParser(obj.label);
	if (browser.browser.name && browser.os.name) {
		obj.browser = browser;
	}
	return obj;
};

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------
TokenSchema.statics.toSimple = function(token) {
	const obj = token.toObj ? token.toObj() : token;
	return _.pick(obj, apiFields.simple);
};

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TokenSchema.path('label').validate(function(label) {
	return _.isString(label) && validator.isLength(label ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');

TokenSchema.path('scopes').validate(function(scopes) {
	if (!scopes || scopes.length === 0) {
		this.invalidate('scopes', 'Scopes are required');
		return true;
	}
	// for scope validation, fall back to private if invalid type given
	const type = validTypes.includes(this.type) ? this.type : 'private';
	if (!scope.isValid(type, scopes)) {
		this.invalidate('scopes', 'Scopes must be one or more of the following: [ "' + scope.getScopes(type).join('", "') + '" ].');
	}
	return true;
});

TokenSchema.path('type').validate(function(type) {
	if (type === 'application') {
		if (!this.provider) {
			this.invalidate('provider', 'Provider is required for application tokens.');
		}
		const providers = [];
		if (config.vpdb.passport.google.enabled) {
			providers.push('google');
		}
		if (config.vpdb.passport.github.enabled) {
			providers.push('github');
		}
		config.vpdb.passport.ipboard.forEach(ipb => {
			if (ipb.enabled) {
				providers.push(ipb.id);
			}
		});
		if (!providers.includes(this.provider)) {
			this.invalidate('provider', 'Provider must be one of: [ "' + providers.join('", "') + '" ].');
		}
	}
	return true;
});

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
TokenSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
TokenSchema.options.toObject = { virtuals: true, versionKey: false };

/**
 * Generates a token.
 * @returns {string} token
 */
function generate() {
	return crypto.randomBytes(16).toString('hex');
}

mongoose.model('Token', TokenSchema);
logger.info('[model] Schema "Token" registered.');