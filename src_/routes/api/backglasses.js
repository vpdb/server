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

	app.get(settings.apiPath('/backglasses'),        api.anon(api.backglasses.list));
	app.post(settings.apiPath('/backglasses'),       api.auth(api.backglasses.create, 'backglasses', 'add', [ scope.ALL, scope.CREATE ]));
	app.get(settings.apiPath('/backglasses/:id'),    api.anon(api.backglasses.view));
	app.patch(settings.apiPath('/backglasses/:id'),  api.auth(api.backglasses.update, 'backglasses', 'update-own', [ scope.ALL, scope.CREATE ]));
	app.delete(settings.apiPath('/backglasses/:id'), api.auth(api.backglasses.del, 'backglasses', 'delete-own', [ scope.ALL, scope.CREATE ]));

	app.post(settings.apiPath('/backglasses/:id/star'),   api.auth(api.stars.star('backglass'), 'backglasses', 'star', [ scope.ALL, scope.COMMUNITY ]));
	app.delete(settings.apiPath('/backglasses/:id/star'), api.auth(api.stars.unstar('backglass'), 'backglasses', 'star', [ scope.ALL, scope.COMMUNITY ]));
	app.get(settings.apiPath('/backglasses/:id/star'),    api.auth(api.stars.get('backglass'), 'backglasses', 'star', [ scope.ALL, scope.COMMUNITY ]));

	app.post(settings.apiPath('/backglasses/:id/moderate'), api.auth(api.backglasses.moderate, 'backglasses', 'moderate', [ scope.ALL ]));

};