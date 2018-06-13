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

import { intersection, isObject, upperFirst, get } from 'lodash';
import Router, { IRouterOptions } from 'koa-router';
import pathToRegexp from 'path-to-regexp';

import { state } from '../state';
import { logger } from './logger';
import { Context } from './types/context';
import { User } from '../users/user';
import { Release } from '../releases/release';
import { MetricsModel } from 'mongoose';

/**
 * An in-memory cache using Redis.
 *
 * It's used as a middleware in Koa. Routes must enable caching explicitly.
 * Invalidation is done with tags.
 *
 * Counters are cached separately. That means viewing, downloading etc doesn't
 * invalidate the cache. See {@link CacheCounterConfig} for more details.
 *
 * Procedure when adding a cache to a route:
 *   1. Go through all end points performing a *write* operation.
 *   2. Check if the route is affected by the operation. Also make sure to
 *      check nested entities, e.g. updating a release invalidates the game
 *      details as well.
 *   3. If that's the case, make sure the route's matched when invalidating
 *      the end point.
 */
class ApiCache {

	private readonly redisCachePrefix = 'api-cache:';
	private readonly redisRefPrefix = 'api-cache-ref:';
	private readonly redisCounterPrefix = 'api-cache-counter:';

	private readonly cacheRoutes: CacheRoute<any>[] = [];

	private readonly endpoints: Map<string, string> = new Map([
		['release', '/v1/releases'],
		['game', '/v1/games'],
		['backglass', '/v1/backglasses'],
		['medium', '/v1/media'],
	]);

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
			const body = isObject(response.body) ? response.body : JSON.parse(response.body);

			// update counters
			if (cacheRoute.counters) {
				const refs: { counter:CacheCounterConfig<any>, key: string, id: string, c: string }[] = [];
				for (const counter of cacheRoute.counters) {
					for (const c of counter.counters) {
						const counters = counter.get(body, c);
						for (const id of Object.keys(counters)) {
							refs.push({ key: this.getCounterKey(counter.modelName, id, c), id, c, counter });
						}
					}
					// update db of view counter
					if (counter.incrementCounter) {
						await (state.models[upperFirst(counter.modelName)] as MetricsModel<any>).incrementCounter(counter.incrementCounter.getId(body), counter.incrementCounter.counter);
					}
				}
				const values = refs.length > 0 ? (await state.redis.mgetAsync.apply(state.redis, refs.map(r => r.key))) : [];
				for (let i = 0; i < values.length; i++) {
					if (values[i]) {
						refs[i].counter.set(body, refs[i].c, { [refs[i].id]: parseInt(values[i]) });
					}
				}
			}

			ctx.status = response.status;
			ctx.set('X-Cache-Api', 'HIT');
			// todo add auth headers such as x-token-refresh

			// if request body was a string it was prettified, so let's do that again.
			if (!isObject(response.body)) {
				ctx.response.body = JSON.stringify(body, null, '  ');
			} else {
				ctx.response.body = body;
			}
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
	 * @param {string} path Path of the route (same passed to the router).
	 * @param {CacheInvalidationTag} config How responses from the route get invalidated. See {@link CacheInvalidationTag}.
	 * @param {CacheCounterConfig} counters Counter config, see {@link CacheCounterConfig}.
	 */
	public enable<T>(router: Router, path: string, config: CacheInvalidationConfig, counters?:CacheCounterConfig<T>[]) {
		const opts = (router as any).opts as IRouterOptions;
		this.cacheRoutes.push({ path: path, regex: pathToRegexp(opts.prefix + path), config: config, counters: counters });
	}

	/**
	 * Updates a counter cache.
	 *
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} entityId ID of the entity to update
	 * @param {string} counterName Name of the counter, e.g. 'view'.
	 * @param {boolean} decrement If true, don't increment but decrement.
	 */
	public async incrementCounter(modelName: string, entityId: string, counterName: string, decrement: boolean) {
		const key = this.getCounterKey(modelName, entityId, counterName);
		if (decrement) {
			await state.redis.decrAsync(key);
		} else {
			await state.redis.incrAsync(key);
		}
	}

	/**
	 * Clears all caches listing the given entity and the entity's details.
	 *
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} entityId ID of the entity
	 */
	public async invalidateEntity(modelName: string, entityId: string) {
		const tag: CacheInvalidationTag = { entities: { [modelName]: entityId } };
		if (this.endpoints.has(modelName)) {
			tag.path = this.endpoints.get(modelName);
		}
		await this.invalidate([tag]);
	}

	/**
	 * Invalidates caches depending on a star.
	 *
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {User} user User who starred the entity
	 * @param entity Starred entity
	 */
	public async invalidateStarredEntity(modelName: string, entity: any, user: User) {
		const tags:CacheInvalidationTag[][] = [];
		if (this.endpoints.has(modelName)) {
			tags.push([{ path: this.endpoints.get(modelName) }, { user: user }]);
		}
		if (entity._game && entity._game.id) {
			tags.push([{ path: '/v1/games/' + entity._game.id }, { user: user }]);
		}
		await this.invalidate(...tags);
	}

	public async invalidateRelease(release?: Release) {
		if (release) {
			await this.invalidateEntity('release', release.id);
		} else {
			await this.invalidate([{ resources: ['release'] }]);
		}
	}

	public async invalidateReleaseComment(release: Release) {
		await this.invalidate([{ entities: { releaseComment: release.id } }]);
	}

	/**
	 * Invalidates all caches containing an entity type.
	 *
	 * @param {string} modelName Name of the model, e.g. "game"
	 */
	public async invalidateAllEntities(modelName: string) {

		// 1. invalidate tagged resources
		await this.invalidate([{ resources: [modelName] }]);

		// 2. invalidate entities
		const entityRefs = await state.redis.keysAsync(this.getEntityKey(modelName, '*'));
		const keys = await state.redis.sunionAsync(entityRefs);
		logger.verbose('[ApiCache.invalidateAllEntities] Clearing: %s', keys.join(', '));
		await state.redis.delAsync(keys);
	}

	/**
	 * Invalidates a cache.
	 *
	 * The tags describe how the cache is invalidated. Every
	 * `CacheInvalidationTag` is an operator in a logical `and`, while its attributes
	 * compose an `or` condition.
	 *
	 * Examples:
	 *
	 * - `invalidate([{ user: foo, path: '/v1/bar' }])` invalidates all caches
	 *    for user foo and all caches for path `/v1/bar`.
	 * - `invalidate([{ user: foo }, { path: '/v1/games' }], [{ path: '/v1/bar' }])`
	 *    invalidates all `/v1/games` caches for user foo as well as all `/v1/bar`
	 *    caches for everyone.
	 *
	 * @param {CacheInvalidationTag[][]} tagLists
	 * @return {Promise<number>}
	 */
	private async invalidate(...tagLists: CacheInvalidationTag[][]): Promise<number> {

		if (!tagLists || tagLists.length === 0) {
			logger.debug('[Cache.invalidate]: Nothing to invalidate.');
			return;
		}

		const now = Date.now();
		const allRefs:string[][][] = [];
		let invalidationKeys = new Set<string>();
		for (let i = 0; i < tagLists.length; i++) {
			const tags = tagLists[i];
			allRefs[i] = [];
			const keys:string[][] = [];
			for (const tag of tags) {
				const refs: string[] = [];

				// path
				if (tag.path) {
					refs.push(this.getPathKey(tag.path));
				}

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
				allRefs[i].push(refs);
				const union = await state.redis.sunionAsync(...refs);
				// logger.wtf('SUNION %s -> %s', refs.join(' '), union.join(','));
				keys.push(union);
			}
			// logger.verbose('invalidationKeys = new Set(%s | inter(%s))', Array.from(invalidationKeys).join(','), keys.map(k => '[' + k.join(',') + ']').join(','));
			// logger.verbose('invalidationKeys = new Set(%s | %s)', Array.from(invalidationKeys).join(','), intersection(...keys).join(','));
			invalidationKeys = new Set([...invalidationKeys, ...intersection(...keys)]); // redis could do this too using SUNIONSTORE to temp sets and INTER them
		}
		logger.info('[ApiCache.invalidate]: Invalidating caches: (%s).',
			'(' + allRefs.map(r => '(' + r.map(r => r.join(' || ')).join(') && (') + ')').join(') || (') + ')');

		let n = 0;
		for (const key of invalidationKeys) {
			// logger.wtf('DEL %s', key);
			await state.redis.delAsync(key);
			n++;
		}
		logger.info('[ApiCache.invalidate]: Cleared %s caches in %sms.', n, Date.now() - now);
		return n;
	}

	/**
	 * Invalidates all caches.
	 * @see https://github.com/galanonym/redis-delete-wildcard/blob/master/index.js
	 * @return {Promise<number>} Number of invalidated caches
	 */
	public async invalidateAll(): Promise<number> {
		return this.deleteWildcard('api-cache*');
	}

	/**
	 * Caches a miss.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} key Cache key
	 * @param {CacheRoute} cacheRoute Route where the miss occurred
	 */
	private async setCache<T>(ctx: Context, key: string, cacheRoute: CacheRoute<T>) {

		let body:any;
		const now = Date.now();
		const refs: (() => Promise<any>)[] = [];
		const refKeys: string[] = [];
		const response: CacheResponse = {
			status: ctx.status,
			headers: ctx.headers,
			body: ctx.response.body
		};

		// set the cache todo set ttl to user caches
		await state.redis.setAsync(key, JSON.stringify(response));

		// reference path
		const toPath = pathToRegexp.compile(cacheRoute.path);
		const refKey = this.getPathKey(toPath(ctx.params));
		refs.push(() => state.redis.saddAsync(refKey, key));
		refKeys.push(refKey);

		// reference resources
		if (cacheRoute.config.resources) {
			for (const resource of cacheRoute.config.resources) {
				const refKey = this.getResourceKey(resource);
				refs.push(() => state.redis.saddAsync(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference entities
		if (cacheRoute.config.entities) {
			for (const entity of Object.keys(cacheRoute.config.entities)) {
				const refKey = this.getEntityKey(entity, ctx.params[cacheRoute.config.entities[entity]]);
				refs.push(() => state.redis.saddAsync(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference children
		if (cacheRoute.config.children) {
			body = isObject(ctx.response.body) ? ctx.response.body : JSON.parse(ctx.response.body);
			for (const entity of get(body, cacheRoute.config.children.entityField)) {
				const refKey = this.getEntityKey(cacheRoute.config.children.modelName, get(entity, cacheRoute.config.children.idField));
				refs.push(() => state.redis.saddAsync(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference user
		if (ctx.state.user) {
			const refKey = this.getUserKey(ctx.state.user);
			refs.push(() => state.redis.saddAsync(refKey, key));
			refKeys.push(refKey);
		}

		// save counters
		let numCounters = 0;
		if (cacheRoute.counters) {
			const refPairs:any[] = [];
			body = body || (isObject(ctx.response.body) ? ctx.response.body : JSON.parse(ctx.response.body));
			for (const counter of cacheRoute.counters) {
				for (const c of counter.counters) {
					const counters = counter.get(body, c);
					for (const id of Object.keys(counters)) {
						refPairs.push(this.getCounterKey(counter.modelName, id, c));
						refPairs.push(parseInt(counters[id] as any));
						numCounters++;
					}
				}
			}
			if (refPairs.length > 0) {
				refs.push(() => state.redis.msetAsync.apply(state.redis, refPairs));
			}
		}
		await Promise.all(refs.map(ref => ref()));
		logger.debug('[Cache] No hit, saved as "%s" with references [ %s ] and %s counters in %sms.',
			key, refKeys.join(', '), numCounters, Date.now() - now);
	}

	private getCacheKey(ctx: Context): string {
		const normalizedQuery = this.normalizeQuery(ctx);
		return this.redisCachePrefix + (ctx.state.user ? ctx.state.user.id + ':' : '') + ctx.request.path + (normalizedQuery ? '?' : '') + normalizedQuery;
	}

	private getPathKey(path: string): string {
		return this.redisRefPrefix + 'path:' + path;
	}

	private getResourceKey(resource: string): string {
		return this.redisRefPrefix + 'resource:' + resource;
	}

	private getEntityKey(modelName: string, entityId: string): string {
		return this.redisRefPrefix + 'entity:' + modelName + ':' + entityId;
	}

	private getUserKey(user: User): string {
		return this.redisRefPrefix + 'user:' + user.id;
	}

	private getCounterKey(entity:string, entityId:string, counter:string) {
		return this.redisCounterPrefix + entity + ':' + counter + ':' + entityId;
	}

	private normalizeQuery(ctx: Context) {
		return Object.keys(ctx.query).sort().map(key => key + '=' + ctx.query[key]).join('&');
	}

	/**
	 * Clears
	 * @see https://github.com/galanonym/redis-delete-wildcard/blob/master/index.js
	 * @return {Promise<number>} Number of invalidated caches
	 */
	private async deleteWildcard(wildcard:string): Promise<number> {
		const num = await state.redis.evalAsync(
			"local keysToDelete = redis.call('keys', ARGV[1]) " + // find keys with wildcard
			"if unpack(keysToDelete) ~= nil then " +              // if there are any keys
			"return redis.call('del', unpack(keysToDelete)) " +   // delete all
			"else " +
			"return 0 " +                                         // if no keys to delete
			"end ",
			0,                                                    // no keys names passed, only one argument ARGV[1]
			wildcard);
		return num as number;
	}
}

/**
 * Defines how to invalidate cached responses from a given route.
 */
interface CacheRoute<T> {
	regex: RegExp;
	path: string;
	config: CacheInvalidationConfig;
	counters: CacheCounterConfig<T>[];
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
	 * Invalidates a specific path defined by {@link ApiCache.enable}.
	 * Placeholders are replaced with values.
	 */
	path?: string;
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

/**
 * Defines how to invalidate a given route.
 */
export interface CacheInvalidationConfig {
	/**
	 * Reference one or multiple resources.
	 *
	 * Only routes that contain arbitrary instances of the entity are listed
	 * here, like lists that can be sorted. For routes returning one specific
	 * instance, use {@link resources} and for entities *linked* to a
	 * specific object, use {@link children}.
	 *
	 * Multiple resources are needed if a resource is dependent on another
	 * resource, e.g. the games resource which also includes releases and
	 * users.
	 */
	resources?: string[],

	/**
	 * Reference a specific entity.
	 * The key is the entity's model name and the value how it's parsed from
	 * the URL (e.g. `:id` becomes `id`).
	 */
	entities?: { [key: string]: string; };

	/**
	 * References child objects.
	 */
	children?: {
		/**
		 * Name of the model
		 */
		modelName: string;

		/**
		 * Points to array where the children are
		 */
		entityField: string,

		/**
		 * Points to the child's ID.
		 */
		idField: string
	}
}

/**
 * Defines how to handle counters for a given model within a response body.
 *
 * Counter caching works like that:
 *
 * On miss,
 *   1. Response body is computed
 *   2. Using {@link CacheCounterConfig.get}, cache values are retrieved for
 *      every model's counter, using a config for each model
 *   3. Every counter gets a Redis key with the current count.
 *
 * On hit,
 *   1. Response body is retrieved from cache
 *   2. Using {@link CacheCounterConfig.get}, objects that need to be updated
 *      are retrieved for all counters.
 *   3. For those counters, current values are read from Redis.
 *   4. Using {@link CacheCounterConfig.set}, these values are applied to the
 *      cached response body.
 *   5. Return updated body.
 *
 * View counters are a special case because they should get bumped even if a
 * response gets served from the cache, where the API completely skipped.
 * That's what {@link CacheCounterConfig.incrementCounter} is for. If set, the
 * cache middleware will bump the given counter with the provided ID.
 *
 * On non-cached bumps, the metrics module will run {@link ApiCache.incrementCounter},
 * which updates the Redis cache so previously cached responses are up-to-date.
 */
export interface CacheCounterConfig<T> {

	/**
	 * Name of the model the counter is linked to, e.g. "game".
	 */
	modelName: string;

	/**
	 * The counters defined for that model, e.g. [ "downloads", "views" ]
	 */
	counters: string[];

	/**
	 * A function that takes the response body and returns key-value pairs with
	 * entity ID and counter value for the given counter of all model
	 * occurrences of the given body.
	 *
	 * @param {T} response Response body computed by the last middleware
	 * @param {string} counter Counter name, e.g. "views"
	 * @returns {CacheCounterValues} Counter values of all entities in the response body for given counter
	 */
	get: (response:T, counter:string) => CacheCounterValues;

	/**
	 * A function that updates the counters of all occurrences of the given
	 * model for the given counter in a previously cached response body.
	 *
	 * @param {T} response Response body coming from cache
	 * @param {string} counter Counter name, e.g. "views"
	 * @param {CacheCounterValues} values Updated counter values of all entities in the response body for given counter
	 */
	set: (response:T, counter:string, values:CacheCounterValues) => void;

	/**
	 * If set, increments a counter even if fetched from cache.
	 */
	incrementCounter?: {

		/**
		 * Name of the counter, e.g. "views".
		 */
		counter: string;

		/**
		 * Returns the ID of the entity whose counter to increment.
		 * @param {T} response Response body coming from cache
		 * @return {string} ID of the entity
		 */
		getId: (response:T) => string;
	}
}
export type CacheCounterValues = { [key:string]: number };

interface CacheResponse {
	status: number;
	headers: { [key: string]: string };
	body: any;
}

export const apiCache = new ApiCache();