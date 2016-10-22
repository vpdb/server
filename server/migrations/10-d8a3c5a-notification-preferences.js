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

"use strict";

const mongoose = require('mongoose');
const User = mongoose.model('User');

module.exports.up = function(grunt) {
	return User.find().exec().then(users => {
		grunt.log.write('Setting remaining notification flags for %s users.', users.length);
		return Promise.each(users, user => {
			if (user.preferences) {
				user.preferences.contributor_notify_game_request_created = true;
				user.preferences.moderator_notify_release_submitted = true;
				user.preferences.moderator_notify_release_auto_approved = false;
				user.preferences.moderator_notify_release_commented = true;
				user.preferences.moderator_notify_backglass_submitted = true;
				user.preferences.moderator_notify_backglass_auto_approved = true;
				return user.save();
			}
		});
	});
};