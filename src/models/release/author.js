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

const mongoose = require('mongoose');
const toObj = require('../plugins/to-object');
const Schema = mongoose.Schema;

const AuthorSchema = new Schema({
	_user: { type: Schema.ObjectId, required: 'Reference to user must be provided.', ref: 'User' },
	roles: [ String ]
}, { usePushEach: true });

AuthorSchema.statics.toReduced = function(author, opts) {
	return {
		roles: author.roles,
		user: require('mongoose').model('User').toReduced(author._user, opts)
	}
};

AuthorSchema.statics.toSimple = function(author, opts) {
	return {
		roles: author.roles,
		user: require('mongoose').model('User').toSimple(author._user, opts)
	}
};

AuthorSchema.methods.toReduced = function(opts) {
	return AuthorSchema.statics.toReduced(this, opts);
};

AuthorSchema.methods.toSimple = function(opts) {
	return AuthorSchema.statics.toSimple(this, opts);
};

AuthorSchema.plugin(toObj);
AuthorSchema.options.toObject = { virtuals: true, versionKey: false };

module.exports.schema = AuthorSchema;