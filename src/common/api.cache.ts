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

import { isArray } from 'lodash';
import Router, { IRouterOptions } from 'koa-router';
import pathToRegexp from 'path-to-regexp';

import { state } from '../state';
import { logger } from './logger';
import { Context } from './types/context';
import { User } from '../users/user';

class ApiCache {

	private readonly redisPrefix = 'koacache:';

	private readonly cacheRoutes: CacheRoute[] = [];

	public async middleware(ctx: Context, next: () => Promise<any>) {

		// if not a GET or HEAD operation, abort.
		if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD') {
			return await next();
		}

		// check if route to cache
		const cacheRoute = this.cacheRoutes.find(route => route.regex.test(ctx.request.path));
		if (!cacheRoute) {
			return await next();
		}

		const key = this.getCacheKey(ctx);
		const hit = await state.redis.getAsync(key);
		if (hit) {
			const response = JSON.parse(hit) as CacheResponse;
			ctx.status = response.status;
			ctx.set('X-Cache-Api', 'HIT');
			// todo add auth headers such as x-token-refresh
			ctx.response.body = response.body;
			return;
		}
		ctx.set('X-Cache-Api', 'MISS');

		await next();

		if (ctx.status >= 200 && ctx.status < 300) {
			await this.setCache(ctx, key, cacheRoute);
		}
	}

	public enable(router: Router, path: string, resource: string[], entities?: CacheEntity) {
		const opts = (router as any).opts as IRouterOptions;
		this.cacheRoutes.push({ regex: pathToRegexp(opts.prefix + path), resources: resource, entities: entities });
	}

	public async invalidateAll(): Promise<number> {
		return this.invalidate(this.cacheRoutes.map(r => r.resources).reduce((acc, r) => acc.concat(r), []));
	}

	public async invalidate(resources?: string[] | string, entities?: CacheEntity): Promise<number> {
		resources = resources || [];
		entities = entities || {};

		if (!isArray(resources)) {
			resources = [ resources ];
		}
		let keys:string[];
		const refs:string[] = [];
		for (const resource of resources) {
			refs.push(this.getResourceKey(resource));
		}
		for (const entity of Object.keys(entities)) {
			refs.push(this.getEntityKey(entity, entities[entity]));
		}
		logger.info('[Cache.invalidate]: Invalidating caches: [%s].', refs.join(', '));

		keys = await state.redis.sunionAsync(...refs);
		let n = 0;
		for (const key of keys) {
			await state.redis.delAsync(key);
			n++;
		}
		logger.info('[Cache.invalidate]: Cleared %s caches.', n);
		return n;
	}

	private async setCache(ctx: Context, key: string, cacheRoute: CacheRoute) {

		const refs:string[] = [];
		const response: CacheResponse = {
			status: ctx.status,
			headers: ctx.headers,
			body: ctx.body
		};

		// set the cache todo set ttl to user caches
		await state.redis.setAsync(key, JSON.stringify(response));

		// reference resources
		if (cacheRoute.resources) {
			for (const resource of cacheRoute.resources) {
				const refKey = this.getResourceKey(resource);
				await state.redis.saddAsync(refKey, key);
				refs.push(refKey);
			}
		}

		// reference user
		if (ctx.state.user) {
			const refKey = this.getUserKey(ctx.state.user);
			await state.redis.saddAsync(refKey, key);
			refs.push(refKey);
		}

		// reference entities
		if (cacheRoute.entities) {
			for (const entity of Object.keys(cacheRoute.entities)) {
				const refKey = this.getEntityKey(entity, ctx.params[cacheRoute.entities[entity]]);
				await state.redis.saddAsync(refKey, key);
				refs.push(refKey);
			}
		}
		logger.debug('[Cache] No hit, saving as "%s" with references [ %s ].', key, refs.join(', '));
	}

	private getCacheKey(ctx: Context): string {
		return this.redisPrefix + (ctx.state.user ? ctx.state.user.id : 'anon') + ':' + ctx.request.path + '?' + this.normalizeQuery(ctx);
	}

	private getResourceKey(resource: string): string {
		return this.redisPrefix + 'resource:' + resource;
	}

	private getEntityKey(entity: string, entityId: string): string {
		return this.redisPrefix + 'entity:' + entity + ':' + entityId;
	}

	private getUserKey(user: User): string {
		return this.redisPrefix + 'user:' + user.id;
	}

	private normalizeQuery(ctx: Context) {
		return Object.keys(ctx.query).sort().map(key => key + '=' + ctx.query[key]).join('&');
	}

}

export interface CacheEntity {
	[key: string]: string;
}

interface CacheRoute {
	regex: RegExp;
	resources: string[];
	entities?: CacheEntity;
}

interface CacheResponse {
	status: number;
	headers: { [key: string]: string };
	body: any;
}

export const apiCache = new ApiCache();