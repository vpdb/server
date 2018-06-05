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

import { intersection } from 'lodash';
import Router, { IRouterOptions } from 'koa-router';
import pathToRegexp from 'path-to-regexp';

import { state } from '../state';
import { logger } from './logger';
import { Context } from './types/context';
import { User } from '../users/user';

/**
 * An in-memory cache using Redis.
 *
 * It's used as a middleware in Koa. Routes must enable caching explicitly.
 * Invalidation is done with tags.
 */
class ApiCache {

	private readonly redisPrefix = 'api-cache:';
	private readonly cacheRoutes: CacheRoute[] = [];

	/**
	 * The middleware. Stops the chain on cache hit or continues and saves
	 * result to cache, if enabled.
	 *
	 * @param {Context} ctx Koa context
	 * @param {() => Promise<any>} next Next middleware
	 */
	public async middleware(ctx: Context, next: () => Promise<any>) {

		// if not a GET or HEAD operation, abort.
		if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD') {
			return await next();
		}

		// check if enabled for this route
		const cacheRoute = this.cacheRoutes.find(route => route.regex.test(ctx.request.path));
		if (!cacheRoute) {
			return await next();
		}

		// retrieve the cached response
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

		// only cache successful responses
		if (ctx.status >= 200 && ctx.status < 300) {
			await this.setCache(ctx, key, cacheRoute);
		}
	}

	/**
	 * Enables caching for the given route.
	 *
	 * The config defines how caches on that route are tagged for invalidation.
	 *
	 * @param {Router} router Router
	 * @param {string} path Path of the route (same passed to the router)
	 * @param {CacheInvalidationTag} config How responses from the route get invalidated.
	 */
	public enable(router: Router, path: string, config: CacheInvalidationConfig) {
		const opts = (router as any).opts as IRouterOptions;
		this.cacheRoutes.push({ regex: pathToRegexp(opts.prefix + path), config: config });
	}

	/**
	 * Invalidates a cache.
	 *
	 * The tags describe how the cache is invalidated. Every
	 * `CacheInvalidationTag` is an operator in a logical `and`, while its attributes
	 * compose an `or` condition.
	 *
	 * @param {CacheInvalidationTag[]} tags
	 * @return {Promise<number>}
	 */
	public async invalidate(...tags: CacheInvalidationTag[]): Promise<number> {

		const now = Date.now();
		const keys:string[][] = [];
		const allRefs:string[][] = [];
		for (const tag of tags) {
			const refs:string[] = [];

			// resources
			if (tag.resources) {
				for (const resource of tag.resources) {
					refs.push(this.getResourceKey(resource));
				}
			}
			// entities
			if (tag.entities) {
				for (const entity of Object.keys(tag.entities)) {
					refs.push(this.getEntityKey(entity, tag.entities[entity]));
				}
			}
			// user
			if (tag.user) {
				refs.push(this.getUserKey(tag.user));
			}
			allRefs.push(refs);
			keys.push(await state.redis.sunionAsync(...refs));
		}
		const invalidationKeys = intersection(...keys); // redis could do this too using SUNIONSTORE to temp sets and INTER them
		logger.info('[Cache.invalidate]: Invalidating caches: (%s).', allRefs.map(r => r.join(' || ')).join(') && ('));

		let n = 0;
		for (const key of invalidationKeys) {
			await state.redis.delAsync(key);
			n++;
		}
		logger.info('[Cache.invalidate]: Cleared %s caches in %sms.', n, Date.now() - now);
		return n;
	}

	/**
	 * Invalidates all caches.
	 * @return {Promise<number>} Number of invalidated caches
	 */
	public async invalidateAll(): Promise<number> {
		return await state.redis.delAsync(this.redisPrefix + '*');
	}

	/**
	 * Caches a miss.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} key Cache key
	 * @param {CacheRoute} cacheRoute Route where the miss occurred
	 */
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
		if (cacheRoute.config.resources) {
			for (const resource of cacheRoute.config.resources) {
				const refKey = this.getResourceKey(resource);
				await state.redis.saddAsync(refKey, key);
				refs.push(refKey);
			}
		}

		// reference entities
		if (cacheRoute.config.entities) {
			for (const entity of Object.keys(cacheRoute.config.entities)) {
				const refKey = this.getEntityKey(entity, ctx.params[cacheRoute.config.entities[entity]]);
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
		logger.debug('[Cache] No hit, saving as "%s" with references [ %s ].', key, refs.join(', '));
	}

	private getCacheKey(ctx: Context): string {
		const normalizedQuery = this.normalizeQuery(ctx);
		return this.redisPrefix + (ctx.state.user ? ctx.state.user.id : 'anon') + ':' + ctx.request.path + (normalizedQuery ? '?' : '') + normalizedQuery;
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

/**
 * Defines how to invalidate cached responses from a given route.
 */
interface CacheRoute {
	regex: RegExp;
	config: CacheInvalidationConfig;
}

/**
 * Defines which caches to invalidate.
 *
 * If multiple properties are set, all of them are applied (logical `or`).
 */
export interface CacheInvalidationTag {
	/**
	 * Invalidate one or multiple resources.
	 * All caches tagged with any of the provided resources will be invalidated.
	 */
	resources?: string[],
	/**
	 * Invalidate a specific entity.
	 * The key is the entity's name and the value its parsed ID.
	 * All caches tagged with the entity and ID will be invalidated.
	 */
	entities?: { [key: string]: string; };
	/**
	 * Invalidate user-specific caches.
	 * All caches for that user will be invalidated.
	 */
	user?: User;
}

export interface CacheInvalidationConfig {
	/**
	 * Reference one or multiple resources.
	 *
	 * Multiple resources are needed if a resource is dependent on another
	 * resource, e.g. the games resource which also includes releases and
	 * users.
	 */
	resources?: string[],

	/**
	 * Reference a specific entity.
	 * The key is the entity's name and the value how it's parsed from the URL
	 * (`:id` becomes `id`).
	 */
	entities?: { [key: string]: string; };
}

interface CacheResponse {
	status: number;
	headers: { [key: string]: string };
	body: any;
}

export const apiCache = new ApiCache();