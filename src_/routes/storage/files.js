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

exports.register = function(app, api, storage) {

	app.post(settings.storageProtectedPath('/files'),                      api.auth(api.files.upload, 'files', 'upload', [ scope.ALL ]));
	app.head(settings.storageProtectedPath('/files/:id.[^/]+'),            api.anon(storage.files.head));
	app.head(settings.storageProtectedPath('/files/:variation/:id.[^/]+'), api.anon(storage.files.head));
	app.get(settings.storageProtectedPath('/files/:id.[^/]+'),             api.anon(storage.files.get));  // permission/quota handling is inside.
	app.get(settings.storageProtectedPath('/files/:variation/:id.[^/]+'),  api.anon(storage.files.get));

	// nginx is taking care of this in production
	app.head(settings.storagePublicPath('/files/:id.[^/]+'),            api.anon(storage.files.head));
	app.head(settings.storagePublicPath('/files/:variation/:id.[^/]+'), api.anon(storage.files.head));
	app.get(settings.storagePublicPath('/files/:id.[^/]+'),             api.anon(storage.files.get));  // permission/quota handling is inside.
	app.get(settings.storagePublicPath('/files/:variation/:id.[^/]+'),  api.anon(storage.files.get));
};