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

import IORedis from 'ioredis';
import { upperFirst } from 'lodash';
import { Document, Model } from 'mongoose';

import { config } from './common/settings';
import { Models } from './common/typings/models';
import { Serializers } from './common/typings/serializers';

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
	public models: Models;

	/**
	 * Reference to all serializers
	 */
	public serializers: Serializers;

	/**
	 * Promisified Redis client
	 */
	public redis: IORedis.Redis;

	constructor() {
		(this.models as any) = {};
		(this.serializers as any) = {};
		this.redis = this.setupRedis();
	}

	/**
	 * Returns a model by model name.
	 * @param {string} modelName Name of the model, case insensitive.
	 * @returns {Model<Document>}
	 */
	public getModel<M extends Model<Document> = Model<Document>>(modelName: string): M {
		return this.models[upperFirst(modelName)] as M;
	}

	private setupRedis(): IORedis.Redis {
		return new IORedis({
			port: config.vpdb.redis.port,
			host: config.vpdb.redis.host,
			family: 4,           // 4 (IPv4) or 6 (IPv6)
			db: config.vpdb.redis.db,
		});
	}
}

export const state = new State();
