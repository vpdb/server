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
var async = require('async');
var Pusher = require('pusher');
var config = require('./settings').current;

var User = require('mongoose').model('User');
var Star = require('mongoose').model('Star');

exports.isEnabled = config.vpdb.pusher.enabled;

if (exports.isEnabled) {
	exports.api = new Pusher(config.vpdb.pusher.options);
}

exports.addVersion = function(game, release, version) {
	// find stars of pusher-enabled users
	
	// find explicitly subscribed releases
};

exports.star = function(type, entity, user) {
	if (exports.isUserEnabled(user)) {
		exports.api.trigger('private-user-' + user.id, 'star', { id: entity.id, type: type });
	}
};

exports.unstar = function(type, entity, user) {
	if (exports.isUserEnabled(user)) {
		exports.api.trigger('private-user-' + user.id, 'unstar', { id: entity.id, type: type });
	}
};

/**
 * Returns true if the Pusher API is enabled and the user's plan supports it.
 * @param user User to check
 * @returns {boolean} True if a message can be sent, false otherwise.
 */
exports.isUserEnabled = function(user) {
	return exports.isEnabled && config.vpdb.quota.plans[user._plan].enableRealtime;
};
