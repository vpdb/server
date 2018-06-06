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

import Router from 'koa-router';
import { EndPoint } from '../common/api.endpoint';

import { router as apiRouter } from './authentication.api.router';
import { router as storageRouter } from './authentication.storage.router';
import Application = require('koa');

export class AuthenticationEndPoint extends EndPoint {

	readonly name: string = 'Authentication API';

	private readonly _router: Router;

	constructor() {
		super();
		this._router = apiRouter;

		// // configure google strategy
		// if (config.vpdb.passport.google.enabled) {
		// 	logger.info('[AuthenticationEndPoint] Enabling Google authentication strategy with callback at %s', settings.webUri('/auth/google/callback'));
		// 	passport.use(new GoogleStrategy({
		// 		clientID: config.vpdb.passport.google.clientID,
		// 		clientSecret: config.vpdb.passport.google.clientSecret,
		// 		callbackURL: settings.webUri('/auth/google/callback')
		// 	}, api.verifyCallbackOAuth('google').bind(api)));
		// }
		//
		// // configure github strategy
		// if (config.vpdb.passport.github.enabled) {
		// 	logger.info('[AuthenticationEndPoint] Enabling GitHub authentication strategy with callback at %s', settings.webUri('/auth/github/callback'));
		// 	passport.use(new GitHubStrategy({
		// 		passReqToCallback: true,
		// 		clientID: config.vpdb.passport.github.clientID,
		// 		clientSecret: config.vpdb.passport.github.clientSecret,
		// 		callbackURL: settings.webUri('/auth/github/callback'),
		// 		scope: ['user:email']
		// 	}, api.verifyCallbackOAuth('github').bind(api)));
		// }
		//
		// // configure ips strategies
		// config.vpdb.passport.ipboard.forEach(ipbConfig => {
		// 	if (ipbConfig.enabled) {
		//
		// 		const callbackUrl = settings.webUri('/auth/' + ipbConfig.id + '/callback');
		// 		logger.info('[AuthenticationEndPoint|ips:' + ipbConfig.id + '] Enabling IP.Board authentication strategy for "%s" at %s.', ipbConfig.name, callbackUrl);
		// 		if (ipbConfig.version === 3) {
		// 			passport.use(new IPBoard3Strategy({
		// 				passReqToCallback: true,
		// 				name: ipbConfig.id,
		// 				baseURL: ipbConfig.baseURL,
		// 				clientID: ipbConfig.clientID,
		// 				clientSecret: ipbConfig.clientSecret,
		// 				callbackURL: callbackUrl
		// 			}, api.verifyCallbackOAuth('ipboard', ipbConfig.id).bind(api)));
		// 		}
		// 		if (ipbConfig.version === 4) {
		// 			passport.use(new IPBoard4Strategy({
		// 				passReqToCallback: true,
		// 				name: ipbConfig.id,
		// 				baseURL: ipbConfig.baseURL,
		// 				clientID: ipbConfig.clientID,
		// 				clientSecret: ipbConfig.clientSecret,
		// 				callbackURL: callbackUrl
		// 			}, api.verifyCallbackOAuth('ipboard', ipbConfig.id).bind(api)));
		// 		}
		// 		if (ipbConfig.version === 4.3) {
		// 			passport.use(new IPBoard43Strategy({
		// 				passReqToCallback: true,
		// 				name: ipbConfig.id,
		// 				baseURL: ipbConfig.baseURL,
		// 				clientID: ipbConfig.clientID,
		// 				clientSecret: ipbConfig.clientSecret,
		// 				callbackURL: callbackUrl,
		// 				scope: ['profile', 'email']
		// 			}, api.verifyCallbackOAuth('ipboard', ipbConfig.id).bind(api)));
		// 		}
		// 	}
		//});
	}

	getRouter(): Router {
		return this._router;
	}

	async register(app: Application): Promise<void> {
		// nothing to initialize
	}
}

export class AuthenticationStorageEndPoint extends EndPoint {

	readonly name: string = 'Storage Authentication API';

	private readonly _router: Router;

	constructor() {
		super();
		this._router = storageRouter;
	}

	getRouter(): Router {
		return this._router;
	}

	async register(app: Application): Promise<void> {
		// nothing to register
	}
}