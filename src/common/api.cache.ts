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

import Router, { IRouterOptions } from 'koa-router';
import { capitalize, get, intersection, isObject } from 'lodash';
import pathToRegexp from 'path-to-regexp';

import { MetricsDocument, MetricsModel } from 'mongoose';
import { GameDocument } from '../games/game.document';
import { ReleaseDocument } from '../releases/release.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { logger } from './logger';
import { Context, RequestState } from './typings/context';

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

	private readonly cacheRoutes: Array<CacheRoute<any>> = [];

	private readonly endpoints: Map<string, string> = new Map([
		['release', '/v1/releases'],
		['game', '/v1/games'],
		['backglass', '/v1/backglasses'],
		['medium', '/v1/media'],
	]);

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
	public enable<T>(router: Router, path: string, config: CacheInvalidationConfig, counters?: Array<CacheCounterConfig<T>>) {
		const opts = (router as any).opts as IRouterOptions;
		this.cacheRoutes.push({ path, regex: pathToRegexp(opts.prefix + path), config, counters });
	}

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
			return next();
		}

		// check if enabled for this route
		const cacheRoute = this.cacheRoutes.find(route => route.regex.test(ctx.request.path));
		if (!cacheRoute) {
			return next();
		}

		// retrieve the cached response
		const key = this.getCacheKey(ctx);
		const hit = await state.redis.get(key);

		if (hit) {

			const response = await this.updateCounters(cacheRoute, hit);
			ctx.status = response.status;

			// set headers
			for (const header of Object.keys(response.headers)) {
				ctx.set(header.split('-').map(capitalize).join('-'), response.headers[header]);
			}
			ctx.set('X-Cache-Api', 'HIT');
			ctx.response.body = response.body;

		} else {

			ctx.set('X-Cache-Api', 'MISS');
			await next();

			// only cache successful responses
			if (ctx.status >= 200 && ctx.status < 300) {
				await this.setCache(ctx, key, cacheRoute);
			}
		}
	}

	/**
	 * Clears all caches listing the given entity and the entity's details.
	 *
	 * @param requestState For logging
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} entityId ID of the entity
	 */
	public async invalidateDirtyEntity(requestState: RequestState, modelName: string, entityId: string) {
		const tag: CacheInvalidationTag = { entities: { [modelName]: entityId } };
		if (this.endpoints.has(modelName)) {
			tag.path = this.endpoints.get(modelName);
		}
		await this.invalidate(requestState, [tag]);
	}

	/**
	 * A game has been added, updated or deleted. Invalidates game details
	 * and game lists.
	 *
	 * @param requestState For logging
	 * @param game Changed, added or removed game
	 */
	public async invalidateGame(requestState: RequestState, game: GameDocument) {
		await this.invalidateDirtyEntity(requestState, 'game', game.id);
	}

	/**
	 * A release has been added, updated or deleted. Invalidates release details,
	 * release lists and the release's game.
	 *
	 * @param requestState For logging
	 * @param release Changed, added or removed release
	 */
	public async invalidateRelease(requestState: RequestState, release: ReleaseDocument) {
		await this.invalidateDirtyEntity(requestState, 'release', release.id);
		await this.invalidate(requestState, [{ entities: { game: (release._game as GameDocument).id } }]);
	}

	public async invalidateReleaseComment(requestState: RequestState, release: ReleaseDocument) {
		await this.invalidate(requestState, [{ entities: { releaseComment: release.id } }]);
	}

	/**
	 * Updates a counter cache.
	 *
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {string} entityId ID of the entity to update
	 * @param {string} counterName Name of the counter, e.g. 'view'.
	 * @param {number} [value=1] How much to increment. Use a negative value for decrement
	 */
	public async incrementCounter(modelName: string, entityId: string, counterName: string, value: number = 1) {
		const key = this.getCounterKey(modelName, entityId, counterName);
		if (value > 0) {
			await state.redis.incrby(key, value);
		} else {
			await state.redis.decrby(key, -value);
		}
	}

	/**
	 * Invalidates caches for a user after (un)starring.
	 *
	 * @param requestState For logging
	 * @param {string} modelName Name of the model, e.g. "game"
	 * @param {UserDocument} user User who starred the entity
	 * @param entity Starred entity
	 */
	public async invalidateStarredEntity(requestState: RequestState, modelName: string, entity: any, user: UserDocument) {
		const tags: CacheInvalidationTag[][] = [];

		/** list endpoints that include the user's starred status in the payload */
		const modelsListingStar = ['release'];

		if (modelsListingStar.includes(modelName) && this.endpoints.has(modelName)) {
			tags.push([{ path: this.endpoints.get(modelName) }, { user }]);
		}
		if (entity._game && entity._game.id) {
			tags.push([{ path: '/v1/games/' + entity._game.id }, { user }]);
		}
		await this.invalidate(requestState, ...tags);
	}

	/**
	 * Invalidates all caches containing an entity type.
	 *
	 * @param requestState For logging
	 * @param {string} modelName Name of the model, e.g. "game"
	 */
	public async invalidateAllEntities(requestState: RequestState, modelName: string) {

		// 1. invalidate tagged resources
		await this.invalidate(requestState, [{ resources: [modelName] }]);

		// 2. invalidate entities
		const entityRefs = await state.redis.keys(this.getEntityKey(modelName, '*'));
		if (entityRefs.length > 0) {
			const keys = await state.redis.sunion(...entityRefs);
			logger.verbose(requestState, '[ApiCache.invalidateAllEntities] Clearing: %s', keys.join(', '));
			await state.redis.del(keys);
		}
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
	 * @param requestState For logging
	 * @param {CacheInvalidationTag[][]} tagLists
	 * @return {Promise<number>}
	 */
	private async invalidate(requestState: RequestState, ...tagLists: CacheInvalidationTag[][]): Promise<number> {

		if (!tagLists || tagLists.length === 0) {
			logger.debug(requestState, '[Cache.invalidate]: Nothing to invalidate.');
			return;
		}

		const now = Date.now();
		const allRefs: string[][][] = [];
		let invalidationKeys = new Set<string>();
		for (let i = 0; i < tagLists.length; i++) {
			const tags = tagLists[i];
			allRefs[i] = [];
			const keys: string[][] = [];
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
				const union = await state.redis.sunion(...refs);
				// logger.wtf('SUNION %s -> %s', refs.join(' '), union.join(','));
				keys.push(union);
			}
			// logger.verbose('invalidationKeys = new Set(%s | inter(%s))', Array.from(invalidationKeys).join(','), keys.map(k => '[' + k.join(',') + ']').join(','));
			// logger.verbose('invalidationKeys = new Set(%s | %s)', Array.from(invalidationKeys).join(','), intersection(...keys).join(','));
			invalidationKeys = new Set([...invalidationKeys, ...intersection(...keys)]); // redis could do this too using SUNIONSTORE to temp sets and INTER them
		}
		logger.debug(requestState, '[ApiCache.invalidate]: Invalidating caches: (%s).',
			'(' + allRefs.map(r => '(' + r.map(s => s.join(' || ')).join(') && (') + ')').join(') || (') + ')');

		let n = 0;
		for (const key of invalidationKeys) {
			await state.redis.del(key);
			n++;
		}
		logger.debug(requestState, '[ApiCache.invalidate]: Cleared %s caches in %sms.', n, Date.now() - now);
		return n;
	}

	/**
	 * Caches a miss.
	 *
	 * @param {Context} ctx Koa context
	 * @param {string} key Cache key
	 * @param {CacheRoute} cacheRoute Route where the miss occurred
	 */
	private async setCache<T>(ctx: Context, key: string, cacheRoute: CacheRoute<T>) {

		let body: any;
		const now = Date.now();
		const refs: Array<() => Promise<any>> = [];
		const refKeys: string[] = [];
		const response: CacheResponse = {
			status: ctx.status,
			headers: ctx.response.headers,
			body: ctx.response.body,
		};

		// remove irrelevant headers
		for (const header of ['x-cache-api', 'x-token-refresh', 'x-user-dirty', 'access-control-allow-origin', 'vary']) {
			delete response.headers[header];
		}

		// set the cache todo set ttl to user caches
		await state.redis.set(key, JSON.stringify(response));

		// reference path
		const toPath = pathToRegexp.compile(cacheRoute.path);
		const pathRefKey = this.getPathKey(toPath(ctx.params));
		refs.push(() => state.redis.sadd(pathRefKey, key));
		refKeys.push(pathRefKey);

		// reference resources
		if (cacheRoute.config.resources) {
			for (const resource of cacheRoute.config.resources) {
				const refKey = this.getResourceKey(resource);
				refs.push(() => state.redis.sadd(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference entities
		if (cacheRoute.config.entities) {
			for (const entity of Object.keys(cacheRoute.config.entities)) {
				const refKey = this.getEntityKey(entity, ctx.params[cacheRoute.config.entities[entity]]);
				refs.push(() => state.redis.sadd(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference children
		if (cacheRoute.config.children) {
			body = isObject(ctx.response.body) ? ctx.response.body : JSON.parse(ctx.response.body);
			for (const child of get(body, cacheRoute.config.children.entityField)) {
				const refKey = this.getEntityKey(cacheRoute.config.children.modelName, get(child, cacheRoute.config.children.idField));
				refs.push(() => state.redis.sadd(refKey, key));
				refKeys.push(refKey);
			}
		}

		// reference user
		if (ctx.state.user) {
			const refKey = this.getUserKey(ctx.state.user);
			refs.push(() => state.redis.sadd(refKey, key));
			refKeys.push(refKey);
		}

		// save counters
		let numCounters = 0;
		if (cacheRoute.counters) {
			const refPairs: any[] = [];
			body = body || (isObject(ctx.response.body) ? ctx.response.body : JSON.parse(ctx.response.body));
			for (const counter of cacheRoute.counters) {
				for (const c of counter.counters) {
					const counters = counter.get(body, c);
					for (const id of Object.keys(counters)) {
						refPairs.push(this.getCounterKey(counter.modelName, id, c));
						refPairs.push(parseInt(counters[id] as any, 10));
						numCounters++;
					}
				}
			}
			if (refPairs.length > 0) {
				refs.push(() => state.redis.mset.apply(state.redis, refPairs));
			}
		}
		await Promise.all(refs.map(ref => ref()));
		logger.debug(ctx.state, '[Cache] No hit, saved as "%s" with references [ %s ] and %s counters in %sms.',
			key, refKeys.join(', '), numCounters, Date.now() - now);
	}

	private async updateCounters(cacheRoute: CacheRoute<any>, cacheHit: string): Promise<CacheResponse> {

		const response = JSON.parse(cacheHit) as CacheResponse;
		const body = isObject(response.body) ? response.body : JSON.parse(response.body);

		// update counters
		if (cacheRoute.counters) {
			const refs: Array<{ counter: CacheCounterConfig<any>, key: string, id: string, c: string }> = [];
			for (const counter of cacheRoute.counters) {
				for (const c of counter.counters) {
					const counters = counter.get(body, c);
					for (const id of Object.keys(counters)) {
						refs.push({ key: this.getCounterKey(counter.modelName, id, c), id, c, counter });
					}
				}
				// update db of view counter
				if (counter.incrementCounter) {
					await state.getModel<MetricsModel<MetricsDocument>>(counter.modelName).incrementCounter(counter.incrementCounter.getId(body), counter.incrementCounter.counter);
				}
			}
			const values = refs.length > 0 ? (await state.redis.mget.apply(state.redis, refs.map(r => r.key))) : [];
			for (let i = 0; i < values.length; i++) {
				if (values[i]) {
					refs[i].counter.set(body, refs[i].c, { [refs[i].id]: parseInt(values[i], 10) });
				}
			}
		}

		return {
			status: response.status,
			headers: response.headers,
			// if request body was a string it was prettified, so let's do that again.
			body: !isObject(response.body) ? JSON.stringify(body, null, '  ') : body,
		};
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

	private getUserKey(user: UserDocument): string {
		return this.redisRefPrefix + 'user:' + user.id;
	}

	private getCounterKey(entity: string, entityId: string, counter: string) {
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
	private async deleteWildcard(wildcard: string): Promise<number> {
		const num = await state.redis.eval(
			'local keysToDelete = redis.call(\'keys\', ARGV[1]) ' + // find keys with wildcard
			'if unpack(keysToDelete) ~= nil then ' +              // if there are any keys
			'return redis.call(\'del\', unpack(keysToDelete)) ' +   // delete all
			'else ' +
			'return 0 ' +                                         // if no keys to delete
			'end ',
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
	counters: Array<CacheCounterConfig<T>>;
}

/**
 * Defines which caches to clear *when invalidating*.
 *
 * If multiple properties are set, all of them are applied (logical `or`).
 */
export interface CacheInvalidationTag {

	/**
	 * This is the broadest tag. It means that every cache containing the tag
	 * will be invalidated. For example, if a user is updated, every cache
	 * containing the "user" resource tag will be invalidated, independently if
	 * the cache actually contains the updated user.
	 */
	resources?: string[];

	/**
	 * Invalidates a specific route defined by {@link ApiCache.enable}, i.e.
	 * all caches for that route independently of the query parameters. It's
	 * used for list or detail views. TODO really detail views as well?
	 */
	path?: string;

	/**
	 * This is the most specific tag. It invalidates only caches that concern
	 * one specific entity, i.e. the detail view or the detail view of its
	 * parent.
	 *
	 * The key is the entity's model name and the value its ID. For example, to
	 * invalidate release with ID "1234", you would use:
	 *
	 * 		`{ entities: release: '1234' }`
	 */
	entities?: { [key: string]: string; };

	/**
	 * Invalidates all caches produced by a user. Note it's not about actual
	 * user data in the response body, but *who* requested it.
	 *
	 * This is typically applied to resources containing user-specific data such
	 * as the release list containing starred status of each release.
	 */
	user?: UserDocument;
}

/**
 * Defines how a given route is invalidated *when setting up the route*.
 */
export interface CacheInvalidationConfig {

	/**
	 * Configures a route to tag its caches with one or more resource keys.
	 * See {@link CacheInvalidationTag.resources} how they are invalidated.
	 */
	resources?: string[];

	/**
	 * Configures a route to tags its caches with a specific entity. See
	 * {@link CacheInvalidationTag.entities} how they are invalidated.
	 *
	 * The key is the entity's model name and the value the name of the path
	 * parameter of the route. For example, to configure release details, you
	 * would use:
	 *
	 * 		`{ entities: { release: 'id' }}`
	 *
	 * Because `id` (from `/v1/releases/:id`) is the parameter name of the
	 * release ID, and "release" the name of the model.
	 */
	entities?: { [key: string]: string; };

	/**
	 * Configures a route to tag its caches as parent of a list of different
	 * entity types. This makes the parent invalidate when any child matches
	 * {@link CacheInvalidationTag.entities}.
	 *
	 * For example, a game can define that it contains children of type
	 * `release`, that they are listed under the game's `releases` field and
	 * that each release ID can be found as `id` in each child. This
	 * configuration would look like that:
	 *
	 * 		`{ children: { modelName: 'release', entityField: 'releases', idField: 'id' } }`
	 *
	 * That means that if any of the children gets invalidated, the parent gets
	 * invalidated as well.
	 *
	 * Note this works only if a child was attached to its parent at the moment
	 * of caching, for created children, the parent must be invalidated
	 * separately.
	 * @deprecated: Change to individual occurences, such as users, builds, tags, etc
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
	};
}

/**
 * Defines how to handle counters for a given model within a response body.
 *
 * This is now counter caching works:
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
	get: (response: T, counter: string) => CacheCounterValues;

	/**
	 * A function that updates the counters of all occurrences of the given
	 * model for the given counter in a previously cached response body.
	 *
	 * @param {T} response Response body coming from cache
	 * @param {string} counter Counter name, e.g. "views"
	 * @param {CacheCounterValues} values Updated counter values of all entities in the response body for given counter
	 */
	set: (response: T, counter: string, values: CacheCounterValues) => void;

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
		getId: (response: T) => string;
	};
}
export interface CacheCounterValues { [key: string]: number; }

interface CacheResponse {
	status: number;
	headers: { [key: string]: string };
	body: any;
}

export const apiCache = new ApiCache();
