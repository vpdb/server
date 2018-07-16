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
import { difference, extend, intersection, isObject, keys, map, pick, values } from 'lodash';
import { format as formatUrl, parse as parseUrl } from 'url';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { acl } from './acl';
import { ApiError, ApiValidationError } from './api.error';
import { logger } from './logger';
import { scope, Scope } from './scope';
import { config, settings } from './settings';
import { Context } from './typings/context';

export abstract class Api {

	/**
	 * Protects a resource by verifying the permissions of an authenticated user
	 * and the token used for authentication. Also the plan can is verified if
	 * provided.
	 *
	 * The only cases where a logged user is not mandatory are resources with
	 * the SERVICE scope, which are only validated against a valid application
	 * token.
	 *
	 * This also takes care of the dirty user flag, which is sent in the header
	 * if any of the user data changed since the user last accessed the API.
	 *
	 * @param handler    The API controller  launched after authentication
	 * @param resource   Required resource
	 * @param permission Required permissions
	 * @param scopes     Required scopes of the authentication method
	 * @param planAttrs  Key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
	 * @returns A middleware function for Koa
	 */
	public auth(handler: (ctx: Context) => boolean, resource: string, permission: string, scopes: Scope[], planAttrs?: { [key: string]: any }) {

		return async (ctx: Context) => {

			// if this resource is a service resource, only check if scope is correct and no permissions are needed.
			if (scopes && scope.isValid([Scope.SERVICE], scopes) && !resource && !permission && ctx.state.tokenType === 'provider') {
				return handler(ctx);
			}

			// if authentication failed, abort.
			if (ctx.state.authError) {
				// check scopes first, because otherwise we might hit a invalid header error for service resource
				if (ctx.state.tokenScopes && !scope.isValid(scopes, ctx.state.tokenScopes)) {
					throw new ApiError('Your token has an invalid scope: [ "%s" ]. Required: [ "%s" ]', (ctx.state.tokenScopes || []).join('", "'), (scopes || []).join('", "')).status(401).log();
				}
				throw ctx.state.authError;
			}

			/* istanbul ignore if: just to be sure (auth middleware loaded?)... */
			if (!ctx.state.user) {
				throw new ApiError('Something went wrong, authenticated but no user.');
			}

			// now we're authenticated, let's authorize.
			await this.authorizeUser(ctx, ctx.state.user, resource, permission, scopes, planAttrs);

			// now we're authorized, set dirty header if necessary
			const result = await state.redis.get('dirty_user_' + ctx.state.user.id);
			if (result) {
				logger.info('[Api.auth] User <%s> is dirty, telling him in header.', ctx.state.user.email);
				ctx.set('X-User-Dirty', result);
				await state.redis.del('dirty_user_' + ctx.state.user.id);
			}
			ctx.set('X-User-Dirty', '0');

			// continue with request
			await handler(ctx);
		};
	}

	/**
	 * Returns the pagination object.
	 *
	 * @param ctx Koa context
	 * @param [defaultPerPage=10] Default number of items returned if not indicated - default 10.
	 * @param [maxPerPage=50] Maximal number of items returned if not indicated - default 50.
	 * @return {{defaultPerPage: number, maxPerPage: number, page: Number, perPage: Number}}
	 */
	public pagination(ctx: Context, defaultPerPage: number = 20, maxPerPage: number = 50): PaginationOpts {
		return {
			defaultPerPage,
			maxPerPage,
			page: Math.max(ctx.query.page, 1) || 1,
			perPage: Math.max(0, Math.min(ctx.query.per_page, maxPerPage)) || defaultPerPage,
		};
	}

	/**
	 * Adds item count to the pagination object.
	 * @param pagination Current pagination object
	 * @param count Total hits
	 * @returns Updated options
	 */
	public paginationOpts(pagination: PaginationOpts, count: number): { pagination: PaginationOpts } {
		return { pagination: extend(pagination, { count }) };
	}

	/**
	 * Instantiates a new router with the API prefix.
	 * @return API router
	 */
	public apiRouter() {
		/* istanbul ignore else: test server uses a prefix */
		if (config.vpdb.api.pathname) {
			return new Router({ prefix: config.vpdb.api.pathname });

		} else {
			return new Router();
		}
	}

	/**
	 * Instantiates a new router with the storage prefix.
	 * @return Storage router
	 */
	public storageRouter(useProtected: boolean) {
		const storageConfig = useProtected ? config.vpdb.storage.protected.api : config.vpdb.storage.public.api;
		/* istanbul ignore else: test server uses a prefix */
		if (storageConfig.pathname) {
			return new Router({ prefix: storageConfig.pathname });

		} else {
			return new Router();
		}
	}

	/**
	 * The API call was successful.
	 *
	 * @param ctx          Koa context
	 * @param body         Response body or null if no response body to send.
	 * @param [status=200] HTTP status code
	 * @param [opts]       Additional options such as pagination options and headers.
	 * @return {boolean}   Boolean indicating success.
	 */
	protected success(ctx: Context, body?: any, status: number = 200, opts: SuccessOpts = {}) {

		if (opts.pagination) {
			const pageLinks: { first?: string, prev?: string, next?: string, last?: string } = {};
			const currentUrl = parseUrl(settings.apiHost() + ctx.request.url, true);
			delete currentUrl.search;
			const paginatedUrl = (page: number, perPage: number): string => {
				currentUrl.query = extend(currentUrl.query, { page, per_page: perPage });
				return formatUrl(currentUrl);
			};

			const lastPage = Math.ceil(opts.pagination.count / opts.pagination.perPage);
			if (opts.pagination.page > 2) {
				pageLinks.first = paginatedUrl(1, opts.pagination.perPage);
			}
			if (opts.pagination.page > 1) {
				pageLinks.prev = paginatedUrl(opts.pagination.page - 1, opts.pagination.perPage);
			}
			if (opts.pagination.page < lastPage) {
				pageLinks.next = paginatedUrl(opts.pagination.page + 1, opts.pagination.perPage);
			}
			if (opts.pagination.page < lastPage - 1) {
				pageLinks.last = paginatedUrl(lastPage, opts.pagination.perPage);
			}

			if (values(pageLinks).length > 0) {
				ctx.set('Link', values(map(pageLinks, (link, rel) => '<' + link + '>; rel="' + rel + '"')).join(', '));
			}
			ctx.set('X-List-Page', String(opts.pagination.page));
			ctx.set('X-List-Size', String(opts.pagination.perPage));
			ctx.set('X-List-Count', String(opts.pagination.count));
		}

		if (opts.headers) {
			keys(opts.headers).forEach(name => ctx.set(name, opts.headers[name] as string));
		}

		ctx.status = status;
		if (body) {
			ctx.response.body = body;
		}
		return true;
	}

	/**
	 * Creates a MongoDb query out of a list of queries.
	 *
	 * @param query Search queries
	 * @returns {object}
	 */
	protected searchQuery(query: object[]) {
		if (query.length === 0) {
			return {};
		} else if (query.length === 1) {
			return query[0];
		} else {
			return { $and: query };
		}
	}

	/**
	 * Returns the requested fields of the query as an array.
	 * @param {Context} ctx Koa context
	 * @returns {string[]} Requested fields or empty array if none provided.
	 */
	protected getRequestedFields(ctx: Context): string[] {
		return ctx.query && ctx.query.fields ? ctx.query.fields.split(',') : [];
	}

	/**
	 * Returns the IP address of the current request.
	 * @param {Context} ctx
	 */
	protected getIpAddress(ctx: Context): string {
		return ctx.request.get('x-forwarded-for') || ctx.ip || '0.0.0.0';
	}

	/**
	 * Computes the Mongoose order parameters based on the HTTP request.
	 *
	 * @param {Context} ctx Koa context
	 * @param {object} defaultSort Sort modes when none provided
	 * @param {object} paramMap Maps URL parameters to Mongoose fields.
	 * @returns {object} Sort parameter
	 */
	protected sortParams(ctx: Context, defaultSort: { [key: string]: number }, paramMap: { [key: string]: string } = {}) {
		let key: string;
		let order: number;
		let mapOrder: number;
		const sortBy: { [key: string]: number } = {};
		defaultSort = defaultSort || { title: 1 };
		if (ctx.query.sort) {
			let s = ctx.query.sort.match(/^(-?)([a-z0-9_-]+)+$/);
			if (s) {
				order = s[1] ? -1 : 1;
				key = s[2];
				if (paramMap[key]) {
					s = paramMap[key].match(/^(-?)([a-z0-9_.]+)+$/);
					key = s[2];
					mapOrder = s[1] ? -1 : 1;
				} else {
					mapOrder = 1;
				}
				sortBy[key] = mapOrder * order;
			} else {
				return defaultSort;
			}
		} else {
			return defaultSort;
		}
		return sortBy;
	}

	/**
	 * Checks is an object has only changes of a given field.
	 *
	 * @param newObj        Object with changes
	 * @param oldObj        Original object
	 * @param allowedFields Allowed fields to change
	 * @returns False if everything is okay, a list of validation errors otherwise.
	 */
	protected checkReadOnlyFields(newObj: { [key: string]: any }, oldObj: { [key: string]: any }, allowedFields: string[]): ApiValidationError[] | boolean {
		const errors: ApiValidationError[] = [];
		difference(keys(newObj), allowedFields).forEach(field => {
			let newVal: any;
			let oldVal: any;

			// for dates we want to compare the time stamp
			if (oldObj[field] instanceof Date) {
				newVal = newObj[field] ? new Date(newObj[field]).getTime() : undefined;
				oldVal = oldObj[field] ? new Date(oldObj[field]).getTime() : undefined;

				// for objects, serialize first.
			} else if (isObject(oldObj[field])) {
				newVal = newObj[field] ? JSON.stringify(newObj[field]) : undefined;
				oldVal = oldObj[field] ? JSON.stringify(pick(oldObj[field], keys(newObj[field] || {}))) : undefined;

				// otherwise, take raw values.
			} else {
				newVal = newObj[field];
				oldVal = oldObj[field];
			}
			if (newVal && newVal !== oldVal) {
				errors.push({
					message: 'This field is read-only and cannot be changed.',
					path: field,
					value: newObj[field],
				});
			}
		});
		return errors.length ? errors : false;
	}

	/**
	 * Makes sure the post body only contains the given fields and throws an exception otherwise.
	 * @param {Context} ctx Koa context
	 * @param {string[]} updatableFields Updatable fields
	 */
	protected assertFields(ctx: Context, updatableFields: string[]) {
		// fail if invalid fields provided
		const submittedFields = keys(ctx.request.body);
		if (intersection(updatableFields, submittedFields).length !== submittedFields.length) {
			const invalidFields = difference(submittedFields, updatableFields);
			throw new ApiError('Invalid field%s: ["%s"]. Allowed fields: ["%s"]',
				invalidFields.length === 1 ? '' : 's',
				invalidFields.join('", "'),
				updatableFields.join('", "'),
			).status(400);
		}
	}

	/**
	 * Authorizes an authenticated user with given permissions.
	 *
	 * @param ctx        Koa context
	 * @param user       User to authorize
	 * @param resource   Required resource
	 * @param permission Required permission
	 * @param scopes     Required scopes
	 * @param planAttrs  Key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
	 * @throws {ApiError} If authorization failed.
	 */
	private async authorizeUser(ctx: Context, user: UserDocument, resource: string, permission: string, scopes: Scope[], planAttrs: { [key: string]: any }): Promise<void> {

		// check scopes
		if (!scope.isValid(scopes, ctx.state.tokenScopes)) {
			throw new ApiError('Your token has an invalid scope: [ "%s" ] (required: [ "%s" ])', (ctx.state.tokenScopes || []).join('", "'), (scopes || []).join('", "')).status(401).log();
		}

		// check plan config if provided
		if (isObject(planAttrs)) {
			for (const key of keys(planAttrs)) {
				const val = planAttrs[key];
				if (user.planConfig[key] !== val) {
					throw new ApiError('User <%s> with plan "%s" tried to access `%s` but was denied access due to missing plan configuration (%s is %s instead of %s).',
						user.email, user._plan, ctx.url, key, val, user.planConfig[key]).display('Access denied').status(403).log();
				}
			}
		}

		// check permissions
		if (resource && permission) {
			const granted = await acl.isAllowed(user.id, resource, permission);
			if (!granted) {
				throw new ApiError('User <%s> tried to access `%s` but was denied access due to missing permissions to %s/%s.', user.email, ctx.url, resource, permission).display('Access denied').status(403).log();
			}
		}
	}

}

export interface SuccessOpts {
	/**
	 * If set, pagination headers and navigation links will be added.
	 */
	pagination?: PaginationOpts;

	/**
	 * Use this to add additional custom headers
	 */
	headers?: { [key: string]: string | number };
}

export interface PaginationOpts {
	defaultPerPage: number;
	maxPerPage: number;
	page: number;
	perPage: number;
	count?: number;
}
