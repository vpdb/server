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
const logger = require('winston');
const mongoose = require('mongoose');
const paginate = require('mongoose-paginate');
const slackbot = require('../../src/common/slackbot');

const Schema = mongoose.Schema;

// also update slackbot when adding new events
const events = [
	'create_comment',
	'star_game', 'star_release', 'star_user',
	'unstar_game', 'unstar_release', 'unstar_user',
	'rate_game', 'rate_release',
	'upload_rom',
	'create_build', 'update_build', 'delete_build',
	'create_game', 'update_game', 'delete_game',
	'create_release', 'update_release', 'create_release_version', 'update_release_version', 'delete_release', 'validate_release',
	'create_backglass', 'delete_backglass', 'update_backglass',
	'moderate',
	'create_game_request', 'update_game_request', 'delete_game_request'
];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	_actor: { type: Schema.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		game: { type: Schema.ObjectId, ref: 'Game', index: true, sparse: true },
		release: { type: Schema.ObjectId, ref: 'Release', index: true, sparse: true },
		backglass: { type: Schema.ObjectId, ref: 'Backglass', index: true, sparse: true },
		user: { type: Schema.ObjectId, ref: 'User', index: true, sparse: true },
		game_request: { type: Schema.ObjectId, ref: 'GameRequest', index: true, sparse: true },
		build: { type: Schema.ObjectId, ref: 'Build', index: true, sparse: true }
	},
	event: { type: String, 'enum': events, required: true, index: true },
	payload: {},
	is_public: { type: Boolean, required: true, 'default': false },
	ip: { type: String, required: true },
	logged_at: { type: Date, required: true }
};
const LogEventSchema = new Schema(fields, { usePushEach: true });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
LogEventSchema.plugin(paginate);


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

LogEventSchema.statics.log = function(req, event, isPublic, payload, ref, done) {
	const LogEvent = mongoose.model('LogEvent');
	const actor = req.user ? req.user._id : null;
	const log = new LogEvent({
		_actor: actor,
		_ref: ref,
		event: event,
		payload: payload,
		is_public: isPublic,
		ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '0.0.0.0',
		logged_at: new Date()
	});
	return log.save(err => {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[model|logevent] Error saving log for "%s": %s', event, err.message, err);
			logger.error(err);
		}
		if (done) {
			done(err);
		}
		slackbot.logEvent(log);
	});
};

LogEventSchema.statics.diff = function(fromDB, fromAPI) {

	fromDB = _.pick(fromDB, _.keys(fromAPI));
	return _.reduce(fromDB, function(result, val, key) {
		if (!_.isEqual(fromAPI[key], val)) {
			if (_.isObject(val)) {
				let d = LogEventSchema.statics.diff(val, fromAPI[key]);
				result.old[key] = d.old;
				result.new[key] = d.new;
			} else {
				result.old[key] = val;
				result.new[key] = fromAPI[key];
			}

		}
		return result;
	}, { 'old': {}, 'new': {} });
};

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
LogEventSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('LogEvent', LogEventSchema);
logger.info('[model] Schema "LogEvent" registered.');