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

var logger = require('winston');
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	_user:     { type: Schema.ObjectId, required: 'Reference to user must be provided.', ref: 'User', index: true },
	event:     { type: String, index: true },
	data:      { },
	logged_at: { type: Date, required: true }
};

var LogUserSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

LogUserSchema.statics.log = function(user, event, data, done) {
	var LogUser = mongoose.model('LogUser');

	var log = new LogUser({
		_user: user._id,
		event: event,
		data: data,
		logged_at: new Date()
	});
	log.save(function(err) {
		if (err) {
			logger.error('[model|loguser] Error saving log for "%s": %s', event, err.message);
		}
		if (done) {
			done(err);
		}
	});
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