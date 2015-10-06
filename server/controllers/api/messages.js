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
var api = require('./api');
var logger = require('winston');

var pusher = require('../../modules/pusher');
var error = require('../../modules/error')('api', 'messages');

exports.authenticate = function(req, res) {

	if (!pusher.isEnabled) {
		return api.fail(res, error('Pusher API not enabled.'), 404);
	}

	if (!req.body.socket_id) {
		console.log(req.body);
		return api.fail(res, error('Socket ID must be provided as "socket_id".'), 422);
	}
	if (!req.body.channel_name) {
		return api.fail(res, error('Channel name must be provided as "channel_name".'), 422);
	}

	var socketId = req.body.socket_id;
	var channel = req.body.channel_name;
	try {
		var auth = pusher.api.authenticate(socketId, channel);
		logger.log('[pusher] User <%s> successfully authenticated for channel %s.', req.user.email, channel);
		res.send(auth);

	} catch (err) {
		return api.fail(res, error('Error creating Pusher authentication token: %s', err.message), 500);
	}

};
