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

	app.post(settings.apiPath('/tokens'), api.auth(api.tokens.create, 'tokens', 'add', [ scope.ALL ]));
	app.get(settings.apiPath('/tokens'), api.auth(api.tokens.list, 'tokens', 'list', [ scope.ALL ], { enableAppTokens: true }));
	app.get(settings.apiPath('/tokens/:id'), api.anon(api.tokens.view));
	app.delete(settings.apiPath('/tokens/:id'), api.auth(api.tokens.del, 'tokens', 'delete-own', [ scope.ALL ]));
	app.patch(settings.apiPath('/tokens/:id'), api.auth(api.tokens.update, 'tokens', 'update-own', [ scope.ALL ]));
};