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

var settings = require('../../modules/settings');

exports.register = function(app, api) {

	app.get(settings.apiPath('/games'),        api.anon(api.games.list));
	app.head(settings.apiPath('/games/:id'),   api.anon(api.games.head));
	app.get(settings.apiPath('/games/:id'),    api.anon(api.games.view));
	app.post(settings.apiPath('/games'),       api.auth(api.games.create, 'games', 'add'));
	app.delete(settings.apiPath('/games/:id'), api.auth(api.games.del, 'games', 'delete'));

	app.post(settings.apiPath('/games/:id/rating'), api.auth(api.ratings.createForGame, 'games', 'rate'));
	app.put(settings.apiPath('/games/:id/rating'), api.auth(api.ratings.updateForGame, 'games', 'rate'));
	app.get(settings.apiPath('/games/:id/rating'), api.auth(api.ratings.getForGame, 'games', 'rate'));

	app.post(settings.apiPath('/games/:id/star'), api.auth(api.stars.starGame, 'games', 'star'));
	app.delete(settings.apiPath('/games/:id/star'), api.auth(api.stars.unstarGame, 'games', 'star'));
	app.get(settings.apiPath('/games/:id/star'), api.auth(api.stars.getForGame, 'games', 'star'));

	app.get(settings.apiPath('/games/:id/events'), api.anon(api.events.list({ byGame: true })));

};