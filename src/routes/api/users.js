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

	app.post(settings.apiPath('/users'),       api.users.create);
	app.put(settings.apiPath('/users'),        api.auth(api.users.createOrUpdate, '', '', [ scope.SERVICE ]));
	app.get(settings.apiPath('/users'),        api.auth(api.users.list, 'users', 'search', [ scope.ALL ]));
	app.get(settings.apiPath('/users/:id'),    api.auth(api.users.view, 'users', 'view', [ scope.ALL ]));
	app.put(settings.apiPath('/users/:id'),    api.auth(api.users.update, 'users', 'update', [ scope.ALL ]));
	app.delete(settings.apiPath('/users/:id'), api.auth(api.users.del, 'users', 'delete', [ scope.ALL ]));

	app.post(settings.apiPath('/users/:id/star'),   api.auth(api.stars.star('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));
	app.delete(settings.apiPath('/users/:id/star'), api.auth(api.stars.unstar('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));
	app.get(settings.apiPath('/users/:id/star'),    api.auth(api.stars.get('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));

	app.get(settings.apiPath('/users/:id/events'),             api.anon(api.events.list({ byActor: true })));
	app.post(settings.apiPath('/users/:id/send-confirmation'), api.auth(api.users.sendConfirmationMail, 'users', 'send-confirmation', [ scope.ALL ]));

};