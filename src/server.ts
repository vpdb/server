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

import Application from 'koa';
import koaBodyParser from 'koa-bodyparser';
import { uniq } from 'lodash';

import { EndPoint } from './common/types/endpoint';
import { config, settings } from './common/settings'
import { koaLogger } from './common/middleware/logger';
import { koaAuth } from './common/middleware/auth';
import { koaRedisCache } from './common/middleware/cache';
import { koaErrorHandler } from './common/middleware/error.handler';
import { koa404Handler } from './common/middleware/notfound.handler';
import { logger } from './common/logger';

const koaResponseTime = require('koa-response-time');
const koaCors = require('@koa/cors');

export class Server {

	private app: Application;

	constructor() {
		this.app = new Application();
		this.app.use(koaLogger());
		this.app.use(koaBodyParser());
		this.app.use(koaResponseTime());
		this.app.use(koaErrorHandler());
		this.app.use(koaAuth());
		this.app.use(koaCors());
//		this.app.use(koaRedisCache());
	}

	public register<T>(endPoint: EndPoint) {

		// routes
		const router = endPoint.getRouter();
		if (router) {
			this.app.use(router.routes());
			this.app.use(router.allowedMethods());

			// pretty print registered paths with methods
			const methods:Map<string, string[]> = new Map<string, string[]>();
			router.stack.forEach(layer => methods.set(layer.path, [ ...methods.get(layer.path) || [], ...layer.methods ]));
			uniq(router.stack.map(layer => layer.path)).sort().forEach(path => {
				logger.info('  %s (%s)', path, methods.get(path).join(','));
			});
		}

		// register app (set models and serializer)
		endPoint.register(this.app);
	}

	public postRegister() {
		this.app.use(koa404Handler());
	}

	public start() {
		this.app.listen(config.vpdb.api.port);
		logger.info('[Server.start] Storage ready at %s', settings.storageProtectedUri());
		logger.info('[Server.start] API ready at %s', settings.apiUri());
	}
}

export const server = new Server();