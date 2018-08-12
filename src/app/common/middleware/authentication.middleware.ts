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

import { decode as jwtDecode } from 'jwt-simple';
import { AuthenticationUtil, Jwt } from '../../authentication/authentication.util';
import { state } from '../../state';
import { UserDocument } from '../../users/user.document';
import { ApiError } from '../api.error';
import { config, settings } from '../settings';
import { Context } from '../typings/context';

/**
 * Middleware that populates the authentication state. It sets:
 *
 * - `ctx.state.user`: The user, when authentication succeeded
 * - `ctx.state.authError`: The exception, when authentication failed
 * - `ctx.state.appToken`: The token, if authenticated via database (application token)
 * - `ctx.state.tokenType`: The token type
 * - `ctx.state.tokenScopes`: The scopes of the token
 * - `ctx.state.tokenProvider`: The provider, if provider token
 *
 * Note this doesn't authorize anything, see {@link Api.auth()} for that.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>} Koa middleware
 */
export function koaAuth() {
	return async function authenticate(ctx: Context, next: () => Promise<any>) {
		try {
			delete ctx.state.user;
			delete ctx.state.appToken;
			delete ctx.state.tokenType;
			delete ctx.state.tokenScopes;

			// get token sent by user
			const token = retrieveToken(ctx);

			// try to authenticate with token
			const user = /[0-9a-f]{32,}/i.test(token.value) ?
				await authenticateWithAppToken(ctx, token) : // app token?
				await authenticateWithJwt(ctx, token);  // otherwise, assume it's a JWT.

			// log to sqreen
			/* istanbul ignore if */
			if (process.env.SQREEN_ENABLED) {
				require('sqreen').identify(ctx.req, { email: user.email });
			}

			// update state
			ctx.state.user = user;
			ctx.response.set('X-User-Id', user.id);

		} catch (err) {

			if (err.isApiError) {
				// update state with error if it's API-related
				ctx.state.authError = err;

			} else {
				// otherwise, re-throw (this is unexpected)
				/* istanbul ignore next */
				throw err;
			}
		}

		// continue with next middleware
		await next();
	};
}

/**
 * Retrieves the token from either URL or HTTP header.
 *
 * @param ctx Koa context
 * @returns {{value: string, fromUrl: boolean}} Token
 * @throws {ApiError} If no token found or incorrect header.
 */
function retrieveToken(ctx: Context): { value: string, fromUrl: boolean } {
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
			fromUrl: false,
		};

	} else if (ctx.query && ctx.query.token) {
		return {
			value: ctx.query.token,
			fromUrl: true,
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
 * @param ctx   Koa context
 * @param token Retrieved token
 * @returns {Promise<UserDocument | null>} Authenticated user on success or null on successful service resource authentication.
 * @throws {ApiError} If provided token is invalid.
 */
async function authenticateWithAppToken(ctx: Context, token: { value: string, fromUrl: boolean }): Promise<UserDocument | null> {

	const vpdbUserIdHeader = 'x-vpdb-user-id';
	const providerUserIdHeader = 'x-user-id';

	// application tokens aren't allowed in the url
	if (token.fromUrl) {
		throw new ApiError('Application tokens must be provided in the header.').status(401);
	}

	const appToken = await state.models.Token.findOne({ token: token.value }).populate('_created_by').exec();

	// fail if not found
	if (!appToken) {
		throw new ApiError('Invalid application token.').status(401);
	}

	// fail if incorrect plan
	if (appToken.type === 'personal' && !(appToken._created_by as UserDocument).planConfig.enableAppTokens) {
		throw new ApiError('Your current plan "%s" does not allow the use of personal tokens. Upgrade or contact an admin.', (appToken._created_by as UserDocument).planConfig.id).status(401);
	}

	// fail if expired
	if (appToken.expires_at.getTime() < Date.now()) {
		throw new ApiError('Application token has expired.').status(401);
	}

	// fail if inactive
	if (!appToken.is_active) {
		throw new ApiError('Token is inactive.').status(401);
	}

	// so we're good here!
	ctx.state.appToken = appToken;
	ctx.state.tokenType = appToken.type;
	ctx.state.tokenScopes = appToken.scopes;

	let user: UserDocument;

	// additional checks for provider token
	if (appToken.type === 'provider') {

		ctx.state.tokenProvider = appToken.provider;

		// retrieve user id headers
		const userId = ctx.get(vpdbUserIdHeader);
		const providerUserId = ctx.get(providerUserIdHeader);

		// vpdb user id header provided
		if (userId) {
			user = await state.models.User.findOne({ id: userId });
			if (!user) {
				throw new ApiError('No user with ID "%s".', userId).status(400);
			}
			if (!user.providers[appToken.provider]) {
				throw new ApiError('Provided user has not been authenticated with %s.', appToken.provider).status(400);
			}

		// provider id header provided
		} else if (providerUserId) {
			user = await state.models.User.findOne({ ['providers.' + appToken.provider + '.id']: String(providerUserId) });

			if (!user) {
				throw new ApiError('No user with ID "%s" for provider "%s".', providerUserId, appToken.provider).status(400);
			}

		// if no user header found, fail.
		} else {
			throw new ApiError('Must provide "%s" or "%s" header when using application token.', vpdbUserIdHeader, providerUserIdHeader).status(400);
		}

	} else {
		user = appToken._created_by as UserDocument;
	}
	await appToken.update({ last_used_at: new Date() });
	return user;
}

/**
 * Tries to authenticate with a JSON Web Token.
 *
 * @param ctx   Koa context
 * @param token Retrieved token
 * @returns {Promise<UserDocument>} Authenticated user on success.
 * @throws {ApiError} If provided token is invalid.
 */
async function authenticateWithJwt(ctx: Context, token: { value: string, fromUrl: boolean }): Promise<UserDocument> {

	// validate token
	let decoded: Jwt;
	try {
		decoded = jwtDecode(token.value, config.vpdb.secret, false, 'HS256');
	} catch (e) {
		throw new ApiError('Bad JSON Web Token').log(e).status(401);
	}

	// check for expiration
	const tokenExp = new Date(decoded.exp);
	if (tokenExp.getTime() < new Date().getTime()) {
		throw new ApiError('Token has expired').status(401);
	}

	if (token.fromUrl && !decoded.path) {
		throw new ApiError('Tokens that are valid for any path cannot be provided as query parameter.').status(401);
	}

	// check for path && method
	const extPath = settings.intToExt(ctx.request.path);
	if (decoded.path && (decoded.path !== extPath || (ctx.method !== 'GET' && ctx.method !== 'HEAD'))) {
		throw new ApiError('Token is only valid for "GET/HEAD %s" but got "%s %s".', decoded.path, ctx.method, extPath).status(401);
	}

	const user = await state.models.User.findOne({ id: decoded.iss });
	if (!user) {
		throw new ApiError('No user with ID %s found.', decoded.iss).status(403).log();
	}

	// generate new token if it's a short term token.
	const tokenIssued = new Date(decoded.iat);
	if (tokenExp.getTime() - tokenIssued.getTime() === config.vpdb.apiTokenLifetime) {
		ctx.set('X-Token-Refresh', AuthenticationUtil.generateApiToken(user, new Date(), true));
	}

	ctx.state.tokenScopes = decoded.scp;
	ctx.state.tokenType = decoded.irt ? 'jwt-refreshed' : 'jwt';
	return user;
}
