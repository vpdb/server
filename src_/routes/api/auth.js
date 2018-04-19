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

const passport = require('passport');

const settings = require('../../../src/common/settings');
const config = settings.current;

exports.register = function(app, api) {

	// local authentication
	app.post(settings.apiPath('/authenticate'), api.user.authenticate);

	// mock route for simulating oauth2 callbacks
	if (process.env.NODE_ENV === 'test') {
		app.post(settings.apiPath('/authenticate/mock'), api.anon(api.user.authenticateOAuth2Mock));
	}

	// oauth init
	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { session: false, scope: [ 'user:email' ] }));
		app.get(settings.apiPath('/redirect/github'), passport.authenticate('github', { session: false, scope: [ 'user:email' ] }));
	}
	if (config.vpdb.passport.google.enabled) {
		app.get('/auth/google', passport.authenticate('google', { session: false, scope: 'email' }));
		app.get(settings.apiPath('/redirect/google'), passport.authenticate('google', { session: false, scope: 'email' }));
	}
	config.vpdb.passport.ipboard.forEach(ipbConfig => {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { session: false }));
			app.get(settings.apiPath('/redirect/' + ipbConfig.id), passport.authenticate(ipbConfig.id, { session: false }));
		}
	});

	// oauth callback
	app.get(settings.apiPath('/authenticate/:strategy'), api.anon(api.user.authenticateOAuth2));
};