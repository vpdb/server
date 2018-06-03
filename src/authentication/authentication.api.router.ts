/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import { config, settings } from '../common/settings';
import { AuthenticationApi } from './authentication.api';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';

export const api = new AuthenticationApi();
export const router = api.apiRouter();

const googleAuth = new GoogleStrategy(settings.apiUri('/auth/google'));
const githubAuth = new GitHubStrategy(settings.apiUri('/auth/github'));

// local authentication
router.post('/v1/authenticate', api.anon(api.authenticate.bind(api)));

// // mock route for simulating oauth2 callbacks
// if (process.env.NODE_ENV === 'test') {
// 	router.post(settings.apiPath('/authenticate/mock'), api.anon(api.user.authenticateOAuth2Mock));
// }

// oauth init
if (config.vpdb.passport.github.enabled) {
	router.get('/v1/redirect/github', githubAuth.redirectToProvider.bind(githubAuth));
	router.get('/auth/github',        githubAuth.authenticateOAuth.bind(githubAuth));
}

if (config.vpdb.passport.google.enabled) {
	router.get('/v1/redirect/google', googleAuth.redirectToProvider.bind(googleAuth));
	router.get('/auth/google',        googleAuth.authenticateOAuth.bind(googleAuth));

	// router.get('/auth/google', passport.authenticate('google', { session: false, scope: 'email' }));
	// router.get('/v1/redirect/google', passport.authenticate('google', { session: false, scope: 'email' }));
}
// config.vpdb.passport.ipboard.forEach(ipbConfig => {
// 	if (ipbConfig.enabled) {
// 		router.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { session: false }));
// 		router.get('/v1/redirect/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { session: false }));
// 	}
// });

// oauth callback
//router.get('/v1/authenticate/:strategy', api.anon(api.authenticateOAuth2.bind(api)));