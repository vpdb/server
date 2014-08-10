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

var api = require('./api');

exports.list = function(req, res) {

	var roles = [
		{
			name: 'root',
			description: 'Super user. Can create, edit and delete everything including admins.'
		}, {
			name: 'admin',
			description: 'Site administrator. Can edit everything but other administrator\'s permissions.'
		}, {
			name: 'member',
			description: 'A registered member. This role every user should have. Removing results in having the same permissions as anonymous.'
		}, {
			name: 'contributor',
			description: 'Permission to edit meta data, e.g. games and media.'
		}
	];
	api.success(res, roles);
};
