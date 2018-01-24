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

const scope = require('../../scope');
const settings = require('../../modules/settings');

exports.register = function(app, api) {

	app.get(settings.apiPath('/user'),              api.auth(api.user.view, 'user', 'view', [ scope.ALL ]));
	app.patch(settings.apiPath('/user'),            api.auth(api.user.update, 'user', 'update', [ scope.ALL ]));
	app.get(settings.apiPath('/user/logs'),         api.auth(api.userlogs.list, 'user', 'view', [ scope.ALL ]));
	app.get(settings.apiPath('/user/events'),       api.auth(api.events.list({ loggedUser: true }), 'user', 'view', [ scope.ALL ]));
	app.get(settings.apiPath('/user/confirm/:tkn'), api.anon(api.user.confirm));

};