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

var config = require('./modules/settings').current;

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
	var web = require('./controllers/web');
	var auth = require('./controllers/auth');
	var storage = require('./controllers/storage');

	// API
	// ========================================================================

	// authentication
	app.post('/api/authenticate', api.users.authenticate);
	app.get('/api/authenticate/:strategy', api.users.authenticateOAuth2);

	// files
	app.get('/api/files/:id',     api.anon(api.files.view));
	app.delete('/api/files/:id',  api.auth(api.files.del, 'files', 'delete'));

	// games
	app.get('/api/games',         api.anon(api.games.list));
	app.head('/api/games/:id',    api.anon(api.games.head));
	app.get('/api/games/:id',     api.anon(api.games.view));
	app.post('/api/games',        api.auth(api.games.create, 'games', 'add'));
	app.delete('/api/games/:id',  api.auth(api.games.del, 'games', 'delete'));

	// ipdb
	app.get('/api/ipdb/:id',      api.auth(api.ipdb.view, 'ipdb', 'view'));

	// ping
	app.get('/api/ping',          api.anon(api.ping));

	// profile
	app.get('/api/user',          api.auth(api.users.profile, 'user', 'profile'));

	// roles
	app.get('/api/roles',         api.auth(api.roles.list, 'roles', 'list'));

	// tags
	app.get('/api/tags',          api.anon(api.tags.list));
	app.post('/api/tags',         api.auth(api.tags.create, 'tags', 'add'));

	// users
	app.post('/api/users',        api.users.create);
	app.get('/api/users',         api.auth(api.users.list, 'users', 'search'));
	app.put('/api/users/:id',     api.auth(api.users.update, 'users', 'update'));
	app.delete('/api/users/:id',  api.auth(api.users.del, 'users', 'delete'));

	// vpbuilds
	app.get('/api/vpbuilds',      api.anon(api.vpbuilds.list));
	app.post('/api/vpbuilds',     api.auth(api.vpbuilds.create, 'vpbuilds', 'add'));


	// or else fail
	app.all('/api/*', function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).send({ error: 'No such resource.' });
	});


	// Storage
	// ========================================================================
	app.post('/storage',                api.auth(api.files.upload, 'files', 'upload'));
	app.head('/storage/:id',            api.anon(storage.head));
	app.head('/storage/:id/:variation', api.anon(storage.head));
	app.get('/storage/:id',             api.anon(storage.get));  // permission/quota handling is inside.
	app.get('/storage/:id/:variation',  api.anon(storage.get));


	// Authentication
	// ========================================================================

	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/', session: false }));
		app.get('/auth/github/callback', web.index());
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/', session: false }));
			app.get('/auth/' + ipbConfig.id + '/callback', web.index());
		}
	});

	// mock route for simulating oauth2 callbacks
	if (process.env.NODE_ENV !== 'production') {
		app.post('/auth/mock', auth.passportMock(web));
	}


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