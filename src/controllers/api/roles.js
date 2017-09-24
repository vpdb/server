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

var api = require('./api');

exports.list = function(req, res) {

	var roles = [
		{
			id: 'root',
			name: 'root',
			description: 'Super user. Can create, edit and delete everything including admins.',
			parents: [ 'admin', 'moderator' ]
		}, {
			id: 'admin',
			name: 'Administrator',
			description: 'User administrator. Can edit users and roles. Inherits from member.',
			parents: [ 'member' ]
		}, {
			id: 'moderator',
			name: 'Moderator',
			description: 'Can moderate and delete all entities. Inherits from contributor.',
			parents: [ 'contributor' ]
		}, {
			id: 'contributor',
			name: 'Contributor',
			description: 'Can upload releases, backglasses and ROMs without approval, as well as add and edit games. Inherits from all other contributors.',
			parents: [ 'game-contributor', 'release-contributor', 'backglass-contributor' ]
		}, {
			id: 'game-contributor',
			name: 'Game Contributor',
			description: 'Can add and edit game data. Inherits from member.',
			parents: [ 'member' ]
		}, {
			id: 'release-contributor',
			name: 'Release Contributor',
			description: 'Can upload releases without approval. Inherits from member.',
			parents: [ 'member' ]
		}, {
			id: 'backglass-contributor',
			name: 'Backglass Contributor',
			description: 'Can upload backglasses without approval. Inherits from member.',
			parents: [ 'member' ]
		}, {
			id: 'member',
			name: 'Member',
			description: 'A registered member. This role every user should have. Removing results in having the same permissions as anonymous.',
			parents: [ ]
		},
	];
	api.success(res, roles);
};
