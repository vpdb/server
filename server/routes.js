/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var _ = require('lodash');
var passport = require('passport');

var settings = require('./modules/settings');
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
 * 	- `/auth/*`     OAuth routes of Passport
 *
 * Everything else is static and is defined in `express.js`.
 *
 * @param app
 */
module.exports = function(app) {

	var api = require('./controllers/api');
	var auth = require('./controllers/auth');
	var storage = require('./controllers/storage');

	// API
	// ========================================================================

	// authentication
	app.post(settings.apiPath('/authenticate'), api.user.authenticate);
	if (process.env.NODE_ENV !== 'production') {
		app.post(settings.apiPath('/authenticate/mock'), api.user.authenticateOAuth2Mock); // mock route for simulating oauth2 callbacks
	}
	app.get(settings.apiPath('/authenticate/:strategy'), api.user.authenticateOAuth2);

	// files
	app.get(settings.apiPath('/files/:id'),       api.anon(api.files.view));
	app.delete(settings.apiPath('/files/:id'),    api.auth(api.files.del, 'files', 'delete'));

	// games
	app.get(settings.apiPath('/games'),           api.anon(api.games.list));
	app.head(settings.apiPath('/games/:id'),      api.anon(api.games.head));
	app.get(settings.apiPath('/games/:id'),       api.anon(api.games.view));
	app.post(settings.apiPath('/games'),          api.auth(api.games.create, 'games', 'add'));
	app.delete(settings.apiPath('/games/:id'),    api.auth(api.games.del, 'games', 'delete'));

	// ipdb
	app.get(settings.apiPath('/ipdb/:id'),        api.auth(api.ipdb.view, 'ipdb', 'view'));

	// ping
	app.get(settings.apiPath('/ping'),            api.anon(api.ping));

	// release
	app.post(settings.apiPath('/releases'),       api.auth(api.releases.create, 'releases', 'add'));
	app.delete(settings.apiPath('/releases/:id'), api.auth(api.releases.del, 'releases', 'delete'));

	// roles
	app.get(settings.apiPath('/roles'),           api.auth(api.roles.list, 'roles', 'list'));

	// tags
	app.get(settings.apiPath('/tags'),            api.anon(api.tags.list));
	app.post(settings.apiPath('/tags'),           api.auth(api.tags.create, 'tags', 'add'));
	app.delete(settings.apiPath('/tags/:id'),     api.auth(api.tags.del, 'tags', 'delete-own'));

	// user (own profile)
	app.get(settings.apiPath('/user'),            api.auth(api.user.view, 'user', 'view'));
	app.patch(settings.apiPath('/user'),          api.auth(api.user.update, 'user', 'update'));

	// users (any other user)
	app.post(settings.apiPath('/users'),          api.users.create);
	app.get(settings.apiPath('/users'),           api.auth(api.users.list, 'users', 'search'));
	app.get(settings.apiPath('/users/:id'),       api.auth(api.users.view, 'users', 'view'));
	app.put(settings.apiPath('/users/:id'),       api.auth(api.users.update, 'users', 'update'));
	app.delete(settings.apiPath('/users/:id'),    api.auth(api.users.del, 'users', 'delete'));

	// vpbuilds
	app.get(settings.apiPath('/vpbuilds'),        api.anon(api.vpbuilds.list));
	app.post(settings.apiPath('/vpbuilds'),       api.auth(api.vpbuilds.create, 'vpbuilds', 'add'));
	app.delete(settings.apiPath('/vpbuilds/:id'), api.auth(api.vpbuilds.del, 'vpbuilds', 'delete-own'));


	// or else fail
	app.all(settings.apiPath('/*'), function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).send({ error: 'No such resource.' });
	});
	app.all(/^\/(api|storage)\/[^v][^\d]+/i, function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).send({ error: 'No such resource. Forgot to add the version to the path?' });
	});


	// Storage
	// ========================================================================
	app.post(settings.storagePath('/authenticate'),         api.auth(storage.user.authenticate));
	app.post(settings.storagePath('/files'),                api.auth(api.files.upload, 'files', 'upload'));
	app.head(settings.storagePath('/files/:id'),            api.anon(storage.files.head));
	app.head(settings.storagePath('/files/:id/:variation'), api.anon(storage.files.head));
	app.get(settings.storagePath('/files/:id'),             api.anon(storage.files.get));  // permission/quota handling is inside.
	app.get(settings.storagePath('/files/:id/:variation'),  api.anon(storage.files.get));
	app.get(settings.storagePath('/releases/:release_id'),  api.auth(storage.releases.download, 'files', 'download'));
	app.post(settings.storagePath('/releases/:release_id'),  api.auth(storage.releases.download, 'files', 'download'));


	// Authentication
	// ========================================================================

	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/', session: false }));
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/', session: false }));
		}
	});


	// Legacy
	// ========================================================================

	// JSON API (mock)
	var apiMock = require('./controllers/api-mock');
	app.get('/api-mock/games/:id', apiMock.game);
	app.get('/api-mock/games', apiMock.games);
	app.get('/api-mock/packs', apiMock.packs);
	app.get('/api-mock/releases', apiMock.releases);
	app.get('/api-mock/feed', apiMock.feed);
	app.get('/api-mock/users', apiMock.users);
	app.get('/api-mock/users/:user', apiMock.user);
};