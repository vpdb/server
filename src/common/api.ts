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

import { difference, keys, pick, isObject } from 'lodash';
import { decode as jwtDecode } from 'jwt-simple';
import { Context } from './types/context';
import { logger } from './logger';
import { config, settings } from './settings';
import { ApiError, ApiValidationError } from './api.error';
import Router from 'koa-router';
import { User } from '../users/user';
import { scope, Scope } from './scope';
import { AuthenticationUtil, Jwt } from '../authentication/authentication.util';
import { acl } from './acl';

export abstract class Api {

	/**
	 * No user object is populated, only errors are handled.
	 *
	 * @param {(ctx: Context) => boolean} handler The API controller launched
	 * @returns {(ctx: Context) => Promise<void>} A middleware function for Koa
	 */
	public plain(handler: (ctx: Context) => boolean) {
		return async (ctx: Context) => {
			await this.handleRequest(ctx, handler);
		};
	}

	/**
	 * No authorization is done but tokens are still read and user object
	 * updated if available.
	 *
	 * @param {(ctx: Context) => boolean} handler The API controller launched
	 * @returns {(ctx: Context) => Promise<void>} A middleware function for Koa
	 */
	public anon(handler: (ctx: Context) => boolean) {
		return this.auth(handler, null, null, []);
	}

	/**
	 * Protects a resource by verifying the JWT in the header or query param.
	 * If `resource` and `permission` are set, ACLs are additionally checked.
	 * If `plan` is set, must must be subscribed to that plan.
	 *
	 * In any case, the user must be logged. On success, the `ctx.state.user`
	 * object is set so further down the stack you can read data from it. Also,
	 * `ctx` is used for setting the `X-Token-Refresh` header if necessary.
	 *
	 * @param {(ctx: Context) => boolean} handler The API controller  launched after authentication
	 * @param {string} resource Required resource
	 * @param {string} permission Required permissions
	 * @param {string[]} scopes Required scopes of the authentication method
	 * @param planAttrs Key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
	 * @returns {(ctx: Context) => Promise<any>} A middleware function for Koa
	 */
	public auth(handler: (ctx: Context) => boolean, resource: string, permission: string, scopes: Scope[], planAttrs?: { [key: string]: any }) {

		return async (ctx: Context) => {

			try {
				let user: User | null;
				delete ctx.state.user;

				const token = this.retrieveToken(ctx);

				// app token?
				if (/[0-9a-f]{32,}/i.test(token.value)) {

					user = await this.authenticateWithAppToken(ctx, token, resource, permission, scopes);

					// if authenticated as service resource, we're done here.
					if (user === null) {
						return await this.handleRequest(ctx, handler);
					}

					// Otherwise, assume it's a JWT.
				} else {
					user = await this.authenticateWithJwt(ctx, token);
				}

				// make sure the authorization is given
				await this.authorizeUser(ctx, user, resource, permission, scopes, planAttrs);

				// ---- here the user's authenticated and authorized. ---- //

				// set dirty header if necessary
				const result = await ctx.redis.getAsync('dirty_user_' + user.id);
				if (result) {
					logger.info('[ctrl|auth] User <%s> is dirty, telling him in header.', user.email);
					ctx.set('X-User-Dirty', result);
					await ctx.redis.delAsync('dirty_user_' + user.id);
				}
				ctx.set('X-User-Dirty', '0');

				// log to sqreen
				if (config.vpdb.services.sqreen.enabled) {
					require('sqreen').identify(ctx.req, { email: user.email });
				}

				// update state
				ctx.state.user = user;

				// continue with request
				await this.handleRequest(ctx, handler);

			} catch (err) {
				this.handleError(ctx, err);
			}
		};
	}

	/**
	 * Retrieves the token from either URL or HTTP header.
	 *
	 * @param {Context} ctx Koa context
	 * @returns {{token: string, fromUrl: boolean}} Token
	 * @throws {ApiError} If no token found or incorrect header.
	 */
	private retrieveToken(ctx: Context): { value: string, fromUrl: boolean } {
		const headerName = config.vpdb.authorizationHeader;
		// get token
		if (ctx.get(headerName.toLowerCase())) {

			// validate format
			const parts = ctx.get(headerName.toLowerCase()).split(' ');
			if (parts.length !== 2) {
				throw new ApiError('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
			}
			const scheme = parts[0];
			const credentials = parts[1];
			if (!/^Bearer$/i.test(scheme)) {
				throw new ApiError('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
			}
			return {
				value: credentials,
				fromUrl: false
			};

		} else if (ctx.query && ctx.query.token) {
			return {
				value: ctx.query.token,
				fromUrl: true
			};
		} else {
			throw new ApiError('Unauthorized. You need to provide credentials for this resource').status(401);
		}
	}

	/**
	 * Tries to authenticate with a database token.
	 *
	 * For a "service resource" (a resource available to third-party services
	 * without an authenticated user), `null` is returned in case of success.
	 *
	 * Otherwise, the authenticated user is returned.
	 *
	 * @param {Context} ctx Koa context
	 * @param {{value: string, fromUrl: boolean}} token Retrieved token
	 * @param {string} resource Resource, must be unset for service resources.
	 * @param {string} permission Permission, must be unset for service resources.
	 * @param {Scope[]} scopes Scopes, indicates if the resource is a service resource.
	 * @returns {Promise<User | null>} Authenticated user on success or null on successful service resource authentication.
	 * @throws {ApiError} If provided token is invalid.
	 */
	private async authenticateWithAppToken(ctx: Context, token: { value: string, fromUrl: boolean }, resource: string, permission: string, scopes: Scope[]): Promise<User | null> {

		const vpdbUserIdHeader = 'x-vpdb-user-id';
		const providerUserIdHeader = 'x-user-id';

		// application access tokens aren't allowed in the url
		if (token.fromUrl) {
			throw new ApiError('App tokens must be provided in the header.').status(401);
		}

		const appToken = await ctx.models.Token.findOne({ token: token }).populate('_created_by').exec();

		// fail if not found
		if (!appToken) {
			new ApiError('Invalid app token.').status(401);
		}

		// fail if incorrect plan
		if (appToken.type === 'personal' && !(appToken._created_by as User).planConfig.enableAppTokens) {
			new ApiError('Your current plan "%s" does not allow the use of app tokens. Upgrade or contact an admin.', (appToken._created_by as User).planConfig.id).status(401);
		}

		// fail if expired
		if (appToken.expires_at.getTime() < new Date().getTime()) {
			new ApiError('Token has expired.').status(401);
		}

		// fail if inactive
		if (!appToken.is_active) {
			new ApiError('Token is inactive.').status(401);
		}

		// so we're good here!
		ctx.state.appToken = appToken;
		ctx.state.tokenType = appToken.type;
		ctx.state.tokenScopes = appToken.scopes;

		let user: User;

		// additional checks for application (provider) token
		if (appToken.type === 'application') {

			ctx.state.tokenProvider = appToken.provider;

			// if this resource is a service resource, we don't need a user. But make sure no permissions needed.
			if (scopes && scope.isValid([Scope.SERVICE], scopes) && !resource && !permission) {
				await appToken.update({ last_used_at: new Date() });
				return null;
			}

			// retrieve user id headers
			const userId = ctx.get(vpdbUserIdHeader);
			const providerUserId = ctx.get(providerUserIdHeader);

			// vpdb user id header provided
			if (userId) {
				user = await ctx.models.User.findOne({ id: userId });
				if (!user) {
					throw new ApiError('No user with ID "%s".', userId).status(400);
				}
				if (!user.providers[appToken.provider]) {
					throw new ApiError('Provided user has not been authenticated with %s.', appToken.provider).status(400);
				}

			// provider id header provided
			} else if (providerUserId) {
				user = await ctx.models.User.findOne({ ['providers.' + appToken.provider + '.id']: String(providerUserId) });

				if (!user) {
					throw new ApiError('No user with ID "%s" for provider "%s".', providerUserId, appToken.provider).status(400);
				}

			// if no user header found, fail.
			} else {
				throw new ApiError('Must provide "%s" or "%s" header when using application token.', vpdbUserIdHeader, providerUserIdHeader).status(400);
			}

		} else {
			user = appToken._created_by as User;
		}

		await appToken.update({ last_used_at: new Date() });

		return user;
	}

	/**
	 * Tries to authenticate with a JSON Web Token.
	 *
	 * @param {Context} ctx Koa context
	 * @param {{value: string, fromUrl: boolean}} token Retrieved token
	 * @returns {Promise<User>} Authenticated user on success.
	 * @throws {ApiError} If provided token is invalid.
	 */
	private async authenticateWithJwt(ctx: Context, token: { value: string, fromUrl: boolean }): Promise<User> {

		// validate token
		let decoded: Jwt;
		try {
			decoded = jwtDecode(token, config.vpdb.secret, false, 'HS256');
		} catch (e) {
			throw new ApiError(e, 'Bad JSON Web Token').status(401);
		}

		// check for expiration
		let tokenExp = new Date(decoded.exp);
		if (tokenExp.getTime() < new Date().getTime()) {
			throw new ApiError('Token has expired').status(401);
		}

		if (token.fromUrl && !decoded.path) {
			throw new ApiError('Tokens that are valid for any path cannot be provided as query parameter.').status(401);
		}

		// check for path && method
		let extPath = settings.intToExt(ctx.request.path);
		if (decoded.path && (decoded.path !== extPath || (ctx.method !== 'GET' && ctx.method !== 'HEAD'))) {
			throw new ApiError('Token is only valid for "GET/HEAD %s" but got "%s %s".', decoded.path, ctx.method, extPath).status(401);
		}

		const user = await ctx.models.User.findOne({ id: decoded.iss });
		if (!user) {
			throw new ApiError('No user with ID %s found.', decoded.iss).status(403).log();
		}

		// generate new token if it's a short term token.
		let tokenIssued = new Date(decoded.iat);
		if (tokenExp.getTime() - tokenIssued.getTime() === config.vpdb.apiTokenLifetime) {
			ctx.set('X-Token-Refresh', AuthenticationUtil.generateApiToken(user, new Date(), true));
		}

		ctx.state.tokenScopes = [Scope.ALL];
		ctx.state.tokenType = decoded.irt ? 'jwt-refreshed' : 'jwt';
		return user;
	}

	/**
	 * Authorizes an authenticated user with given permissions.
	 *
	 * @param {Context} ctx Koa context
	 * @param {User} user User to authorize
	 * @param {string} resource Required resource
	 * @param {string} permission Required permission
	 * @param {Scope[]} scopes Required scopes
	 * @param planAttrs Key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
	 * @throws {ApiError} If authorization failed.
	 */
	private async authorizeUser(ctx: Context, user: User, resource: string, permission: string, scopes: Scope[], planAttrs: { [key: string]: any }): Promise<void> {

		// check scopes
		if (!scope.isValid(scopes, ctx.state.tokenScopes)) {
			throw new ApiError('Your token has an invalid scope: [ "%s" ] (required: [ "%s" ])', (ctx.state.tokenScopes || []).join('", "'), (scopes || []).join('", "')).status(401).log();
		}

		// check plan config if provided
		if (isObject(planAttrs)) {
			for (let key of keys(planAttrs)) {
				let val = planAttrs[key];
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

	protected checkReadOnlyFields(newObj: { [key: string]: any }, oldObj: { [key: string]: any }, allowedFields: string[]) {
		const errors: ApiValidationError[] = [];
		difference(keys(newObj), allowedFields).forEach(field => {
			let newVal, oldVal;

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
					value: newObj[field]
				});
			}
		});

		return errors.length ? errors : false;
	}

	/**
	 * The API call was successful.
	 * @param {Application.Context} ctx Koa context
	 * @param {object|null} body Response body or null if no response body to send.
	 * @param {number} [status=200] HTTP status code
	 * @return {boolean}
	 */
	protected success(ctx: Context, body?: any, status?: number) {
		status = status || 200;

		ctx.status = status;
		ctx.body = body;
		return true;
	}

	/**
	 * Creates a MongoDb query out of a list of queries
	 * @param {object[]} query Search queries
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
	};

	/**
	 * Instantiates a new router with the API prefix.
	 * @return {Router}
	 */
	public apiRouter() {
		if (config.vpdb.api.pathname) {
			return new Router({ prefix: config.vpdb.api.pathname });
		} else {
			return new Router();
		}
	}

	/**
	 * Instantiates a new router with the storage prefix.
	 * @return {Router}
	 */
	public storageRouter() {
		if (config.vpdb.storage.protected.api.pathname) {
			return new Router({ prefix: config.vpdb.storage.protected.api.pathname });
		} else {
			return new Router();
		}
	}

	private async handleRequest(ctx: Context, handler: (ctx: Context) => boolean) {
		try {
			const result = await handler(ctx);
			if (result !== true) {
				this.handleError(ctx, new ApiError('Must return success() in API controller.').status(500));
			}
		} catch (err) {
			this.handleError(ctx, err);
		}
	}

	private handleError(ctx: Context, err: ApiError) {
		let message;
		const statusCode = err.statusCode || 500;

		if (statusCode === 500) {
			logger.error(err);
		}

		if (!err.status) {
			message = 'Internal error.';
		} else {
			message = err.message || 'Internal error.';
		}
		ctx.status = statusCode;
		ctx.body = { error: message };
	}
}
