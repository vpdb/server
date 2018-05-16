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
import { Models } from './common/types/models';
import { Serializers } from './common/types/serializers';
import { config, settings } from './common/settings'
import { koaLogger } from './common/middleware/logger';
import { koaAuth } from './common/middleware/auth';
import { logger } from './common/logger';

import Redis = require('redis');
import Bluebird = require('bluebird');
import { RedisClient } from 'redis';

const koaResponseTime = require('koa-response-time');

Bluebird.promisifyAll((Redis as any).RedisClient.prototype);
Bluebird.promisifyAll((Redis as any).Multi.prototype);

export class Server {

	private app: Application;

	constructor() {
		this.app = new Application();
		this.app.use(koaLogger());
		this.app.use(koaBodyParser());
		this.app.use(koaResponseTime());
		this.app.use(koaAuth());

		this.app.context.models = {};
		this.app.context.serializers = {};
		this.app.context.redis = this.setupRedis();
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

	public start() {
		this.app.listen(config.vpdb.api.port);
		logger.info('[app] Storage ready at %s', settings.storageProtectedUri());
		logger.info('[app] API ready at %s', settings.apiUri());
	}

	public models(): Models {
		return this.app.context.models;
	}

	public serializers(): Serializers {
		return this.app.context.serializers;
	}

	private setupRedis(): RedisClient {
		const redis = Redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
		redis.select(config.vpdb.redis.db);
		// todo better error handling (use raygun)
		redis.on('error', err => logger.error(err.message));
		return redis;
	}
}

export const server = new Server();