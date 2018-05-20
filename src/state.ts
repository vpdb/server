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

import { RedisClient } from 'redis';

import { Models } from './common/types/models';
import { Serializers } from './common/types/serializers';
import { logger } from './common/logger';
import { config } from './common/settings';

import Redis = require('redis');
import Bluebird = require('bluebird');

Bluebird.promisifyAll((Redis as any).RedisClient.prototype);
Bluebird.promisifyAll((Redis as any).Multi.prototype);

/**
 * A global state module that is accessible from anywhere.
 *
 * Note that this class doesn't actually contain any state but gives
 * access to models, serializers and redis which retrieve the actual state
 * themselves.
 */
class State {

	/**
	 * Reference to all our database models.
	 */
	models: Models;

	/**
	 * Reference to all serializers
	 */
	serializers: Serializers;

	/**
	 * Promisified Redis client
	 */
	redis: RedisClient;


	constructor() {
		(this.models as any) = {};
		(this.serializers as any) = {};
		this.redis = this.setupRedis();
	}

	private setupRedis(): RedisClient {
		const redis = Redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
		redis.select(config.vpdb.redis.db);
		// todo better error handling (use raygun)
		redis.on('error', err => logger.error(err.message));
		return redis;
	}
}

export const state = new State();