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

var settings = require('../../modules/settings');

exports.register = function(app, api) {

	app.post(settings.apiPath('/users'),          api.users.create);
	app.get(settings.apiPath('/users'),           api.auth(api.users.list, 'users', 'search'));
	app.get(settings.apiPath('/users/:id'),       api.auth(api.users.view, 'users', 'view'));
	app.put(settings.apiPath('/users/:id'),       api.auth(api.users.update, 'users', 'update'));
	app.delete(settings.apiPath('/users/:id'),    api.auth(api.users.del, 'users', 'delete'));

	app.post(settings.apiPath('/users/:id/star'), api.auth(api.stars.starUser, 'users', 'star'));
	app.delete(settings.apiPath('/users/:id/star'), api.auth(api.stars.unstarUser, 'users', 'star'));
	app.get(settings.apiPath('/users/:id/star'), api.auth(api.stars.getForUser, 'users', 'star'));

	app.get(settings.apiPath('/users/:id/events'), api.anon(api.events.list({ byActor: true })));

};