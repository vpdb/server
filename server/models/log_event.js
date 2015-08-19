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
var paginate = require('mongoose-paginate');
var toObj = require('./plugins/to-object');

var Schema = mongoose.Schema;

var events = [
	'create_comment',
	'star_game', 'star_release', 'star_user',
	'unstar_game', 'unstar_release', 'unstar_user'
];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	_actor:      { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		game:    { type: Schema.ObjectId, ref: 'Game', index: true, sparse: true },
		release: { type: Schema.ObjectId, ref: 'Release', index: true, sparse: true },
		user:    { type: Schema.ObjectId, ref: 'User', index: true, sparse: true }
	},
	event:       { type: String, 'enum': events, required: true, index: true },
	payload:     { },
	is_public:   { type: Boolean, required: true, 'default': false },
	ip:          { type: String, required: true },
	logged_at:   { type: Date, required: true }
};
var LogEventSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
LogEventSchema.plugin(paginate);
LogEventSchema.plugin(toObj);


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
LogEventSchema.virtual('actor')
	.get(function() {
		if (this.populated('_actor') && this._actor) {
			return this._actor.toReduced();
		}
		return undefined;
	});


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

LogEventSchema.statics.log = function(req, event, isPublic, payload, ref, done) {
	var LogEvent = mongoose.model('LogEvent');
	var actor = req.user ? req.user._id : null;
	var log = new LogEvent({
		_actor: actor,
		_ref: ref,
		event: event,
		payload: payload,
		is_public: isPublic,
		ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '0.0.0.0',
		logged_at: new Date()
	});
	log.save(function(err) {
		if (err) {
			logger.error('[model|logevent] Error saving log for "%s": %s', event, err.message, err);
			logger.error(err);
		}
		if (done) {
			done(err);
		}
	});
};

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
LogEventSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, log) {
		delete log.__v;
		delete log._id;
		delete log._user;
		delete log._ref;
		delete log.id;
	}
};


mongoose.model('LogEvent', LogEventSchema);
logger.info('[model] Schema "LogEvent" registered.');