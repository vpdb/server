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

const scope = require('../../../src/common/scope');
const settings = require('../../../src/common/settings');

exports.register = function(app, api) {

	// index
	app.get(settings.apiPath(''), api.anon(api.index));
	app.get(settings.apiPath('/'), api.anon(api.index));

	// ipdb
	app.get(settings.apiPath('/ipdb/:id'), api.auth(api.ipdb.view, 'ipdb', 'view', [ scope.ALL ]));

	// roles
	app.get(settings.apiPath('/roles'), api.auth(api.roles.list, 'roles', 'list', [ scope.ALL ]));

	// events
	app.get(settings.apiPath('/events'), api.anon(api.events.list()));

	// pusher
	app.post(settings.apiPath('/messages/authenticate'), api.auth(api.messages.authenticate, 'messages', 'receive', [ scope.ALL ], { enableRealtime: true }));

	// ping
	app.get(settings.apiPath('/ping'), api.anon(api.ping));

	// plans
	app.get(settings.apiPath('/plans'), api.anon(api.plans.list));
};