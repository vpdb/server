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

	app.get(settings.apiPath('/releases'),        api.anon(api.releases.list));
	app.get(settings.apiPath('/releases/:id'),    api.anon(api.releases.view));
	app.patch(settings.apiPath('/releases/:id'),  api.auth(api.releases.update, 'releases', 'update-own'));
	app.post(settings.apiPath('/releases'),       api.auth(api.releases.create, 'releases', 'add'));
	app.delete(settings.apiPath('/releases/:id'), api.auth(api.releases.del, 'releases', 'delete-own'));

	app.post(settings.apiPath('/releases/:id/versions'), api.auth(api.releases.addVersion, 'releases', 'add'));
	app.patch(settings.apiPath('/releases/:id/versions/:version'), api.auth(api.releases.updateVersion, 'releases', 'update-own'));

	app.get(settings.apiPath('/releases/:id/comments'), api.anon(api.comments.listForRelease));
	app.post(settings.apiPath('/releases/:id/comments'), api.auth(api.comments.createForRelease, 'comments', 'add'));

	app.post(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.createForRelease, 'releases', 'rate'));
	app.put(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.updateForRelease, 'releases', 'rate'));
	app.get(settings.apiPath('/releases/:id/rating'), api.auth(api.ratings.getForRelease, 'releases', 'rate'));

	app.post(settings.apiPath('/releases/:id/star'), api.auth(api.stars.star('release'), 'releases', 'star'));
	app.delete(settings.apiPath('/releases/:id/star'), api.auth(api.stars.unstar('release'), 'releases', 'star'));
	app.get(settings.apiPath('/releases/:id/star'), api.auth(api.stars.get('release'), 'releases', 'star'));

	app.post(settings.apiPath('/releases/:id/moderate'), api.auth(api.releases.moderate, 'releases', 'moderate'));
	app.post(settings.apiPath('/releases/:id/moderate/comments'), api.auth(api.comments.createForReleaseModeration, 'releases', 'add'));
	app.get(settings.apiPath('/releases/:id/moderate/comments'), api.auth(api.comments.listForReleaseModeration, 'releases', 'add'));

	app.get(settings.apiPath('/releases/:id/events'), api.anon(api.events.list({ byRelease: true })));
};