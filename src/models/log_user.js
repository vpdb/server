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
var paginate = require('mongoose-paginate');
var slackbot = require('../modules/slackbot');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	_user:     { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	_actor:    { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	event:     { type: String, index: true },
	payload:   { },
	result:    { type: String, 'enum': [ 'success', 'failure' ], required: true },
	message:   { type: String }, // in case of failure, this is the error message.
	ip:        { type: String, required: true },
	logged_at: { type: Date, required: true }
};

var LogUserSchema = new Schema(fields, { usePushEach: true });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
LogUserSchema.plugin(paginate);


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
LogUserSchema.virtual('user')
	.get(function() {
		if (this.populated('_user') && this._user) {
			return this._user.toReduced();
		}
		return undefined;
	});

LogUserSchema.virtual('actor')
	.get(function() {
		if (this.populated('_actor') && this._actor) {
			return this._actor.toReduced();
		}
		return undefined;
	});

//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

LogUserSchema.statics.success = function(req, user, event, payload, actor, done) {
	LogUserSchema.statics.log(req, user, 'success', event, payload, actor, undefined, done);
};

LogUserSchema.statics.failure = function(req, user, event, payload, actor, message, done) {
	LogUserSchema.statics.log(req, user, 'failure', event, payload, actor, message, done);
};

LogUserSchema.statics.log = function(req, user, result, event, payload, actor, message, done) {
	var LogUser = mongoose.model('LogUser');
	actor = actor || user;
	var log = new LogUser({
		_user: user,
		_actor: actor,
		event: event,
		payload: payload,
		ip: req.ip || (req.headers ? req.headers['x-forwarded-for'] : null) || (req.connection ? req.connection.remoteAddress : null) || '0.0.0.0',
		result: result,
		message: message,
		logged_at: new Date()
	});
	log.save(function(err) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[model|loguser] Error saving log for "%s": %s', event, err.message, err);
		}
		/* istanbul ignore if: we usually don't care about the result when logging  */
		if (done) {
			done(err);
		}
		slackbot.logUser(log);
	});
};

LogUserSchema.statics.successDiff = function(req, user, event, obj1, obj2, actor, done) {

	var diff = LogUserSchema.statics.diff(obj1, obj2);
	if (diff && !_.isEmpty(diff.new)) {
		LogUserSchema.statics.success(req, user, event, diff, actor, done);
	}
};

LogUserSchema.statics.diff = function(obj1, obj2) {

	return _.reduce(obj1, function(result, val, key) {
		if (!_.isEqual(obj2[key], val)) {
			result.old[key] = val;
			result.new[key] = obj2[key];
		}
		return result;
	}, { 'old': {}, 'new': {} });
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
LogUserSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('LogUser', LogUserSchema);
logger.info('[model] Schema "LogUser" registered.');