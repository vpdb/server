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

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	_user:     { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	_actor:    { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	event:     { type: String, index: true },
	data:      { },
	result:    { type: String, enum: [ 'success', 'failure' ], required: true },
	message:   { type: String },
	ip:        { type: String, required: true },
	logged_at: { type: Date, required: true }
};

var LogUserSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

LogUserSchema.statics.success = function(req, user, event, data, actor, done) {
	var LogUser = mongoose.model('LogUser');
	actor = actor || user;
	var log = new LogUser({
		_user: user,
		_actor: actor,
		event: event,
		data: data,
		ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '0.0.0.0',
		result: 'success',
		logged_at: new Date()
	});
	log.save(function(err) {
		if (err) {
			logger.error('[model|loguser] Error saving log for "%s": %s', event, err.message, err);
		}
		if (done) {
			done(err);
		}
	});
};

LogUserSchema.statics.diff = function(req, user, event, obj1, obj2, actor, done) {

	var diff = _.reduce(obj1, function(result, val, key) {
		if (obj2[key] !== val) {
			result.old[key] = val;
			result.new[key] = obj2[key];
		}
		return result;
	}, { 'old': {}, 'new': {} });
	if (diff && !_.isEmpty(diff.new)) {
		LogUserSchema.statics.success(req, user, event, diff, actor, done);
	}
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
LogUserSchema.set('toObject', { virtuals: true });
LogUserSchema.options.toObject.transform = function(doc, user) {
	delete user._id;
};


mongoose.model('LogUser', LogUserSchema);
logger.info('[model] Schema "LogUser" registered.');