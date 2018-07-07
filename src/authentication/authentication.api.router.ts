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
import { GitHubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { IpsStrategy } from './strategies/ips.strategy';

export const api = new AuthenticationApi();
export const router = api.apiRouter();

const githubAuth = new GitHubStrategy(settings.webUri('/auth/github/callback'));
const googleAuth = new GoogleStrategy(settings.webUri('/auth/google/callback'));

// local authentication
router.post('/v1/authenticate', api.authenticate.bind(api));

// mock route for simulating oauth2 callbacks
if (process.env.NODE_ENV === 'test') {
	router.post('/v1/authenticate/mock', api.mockOAuth.bind(api));
}

// oauth routes
if (config.vpdb.passport.github.enabled) {
	router.get('/v1/redirect/github',     githubAuth.redirectToProvider.bind(githubAuth));
	router.get('/v1/authenticate/github', githubAuth.authenticateOAuth.bind(githubAuth));
}
if (config.vpdb.passport.google.enabled) {
	router.get('/v1/redirect/google',     googleAuth.redirectToProvider.bind(googleAuth));
	router.get('/v1/authenticate/google', googleAuth.authenticateOAuth.bind(googleAuth));
}
config.vpdb.passport.ipboard.forEach(ips => {
	if (ips.enabled) {
		const ipsAuth = new IpsStrategy(settings.webUri('/auth/' + ips.id + '/callback'), ips);
		router.get('/v1/redirect/' + ips.id,     ipsAuth.redirectToProvider.bind(ipsAuth));
		router.get('/v1/authenticate/' + ips.id, ipsAuth.authenticateOAuth.bind(ipsAuth));
	}
});
