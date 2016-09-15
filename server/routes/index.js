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

var passport = require('passport');

var settings = require('../modules/settings');
var config = settings.current;

/**
 * Defines server-side routing.
 *
 * On server-side, we only care about backend stuff, i.e. the API, the storage
 * engine and the authentication routes. Otherwise just serve index.html and
 * let Angular.JS figure out if it's a valid route (or serve other static
 * assets)
 *
 * So we have:
 *
 * 	- `/api/**`     API
 * 	- `/storage/**` Downloads
 * 	- `/auth/**`    OAuth routes of Passport
 *
 * Everything else is static and is defined in `express.js`.
 *
 * @param app
 */
module.exports = function(app) {

	var api = require('../controllers/api');
	var storage = require('../controllers/storage');

	// api
	require('./api/auth').register(app, api);
	require('./api/games').register(app, api);
	require('./api/game_requests').register(app, api);
	require('./api/files').register(app, api);
	require('./api/misc').register(app, api);
	require('./api/releases').register(app, api);

	require('./api/roms').register(app, api);
	require('./api/tags').register(app, api);
	require('./api/tokens').register(app, api);
	require('./api/user').register(app, api);
	require('./api/users').register(app, api);
	require('./api/builds').register(app, api);
	require('./api/backglasses').register(app, api);
	require('./api/media').register(app, api);

	// storage
	require('./storage/auth').register(app, api, storage);
	require('./storage/files').register(app, api, storage);
	require('./storage/releases').register(app, api, storage);

	// authentication
	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { session: false }));
	}
	if (config.vpdb.passport.google.enabled) {
		app.get('/auth/google', passport.authenticate('google', { session: false, scope: 'email' }));
	}
	config.vpdb.passport.ipboard.forEach(ipbConfig => {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { session: false }));
		}
	});

	// or else fail
	app.all(settings.apiPath('/*'), function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).send({ error: 'No such resource.' });
	});
	app.all(/^\/(api|storage)\/[^v][^\d]+/i, function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).send({ error: 'No such resource. Forgot to add the version to the path?' });
	});

};