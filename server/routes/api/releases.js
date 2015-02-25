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

	app.get(settings.apiPath('/releases'),        api.anon(api.releases.list));
	app.get(settings.apiPath('/releases/:id'),    api.anon(api.releases.view));
	app.post(settings.apiPath('/releases'),       api.auth(api.releases.create, 'releases', 'add'));
	app.delete(settings.apiPath('/releases/:id'), api.auth(api.releases.del, 'releases', 'delete'));

	app.get(settings.apiPath('/releases/:id/comments'), api.anon(api.comments.listForRelease));
	app.post(settings.apiPath('/releases/:id/comments'), api.auth(api.comments.createForRelease, 'comments', 'add'));

	app.post(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.createForRelease, 'ratings', 'add'));
	app.put(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.updateForRelease, 'ratings', 'update'));
	app.get(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.getForRelease, 'ratings', 'view'));
};