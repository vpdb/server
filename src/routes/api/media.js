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

const settings = require('../../modules/settings');

exports.register = function(app, api) {

	app.post(settings.apiPath('/media'),       api.auth(api.media.create, 'media', 'add'));
	app.delete(settings.apiPath('/media/:id'), api.auth(api.media.del, 'media', 'delete-own'));

	app.post(settings.apiPath('/media/:id/star'),   api.auth(api.stars.star('medium'), 'media', 'star'));
	app.delete(settings.apiPath('/media/:id/star'), api.auth(api.stars.unstar('medium'), 'media', 'star'));
	app.get(settings.apiPath('/media/:id/star'),    api.auth(api.stars.get('medium'), 'media', 'star'));

};