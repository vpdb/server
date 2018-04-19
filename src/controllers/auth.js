/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const _ = require('lodash');
const jwt = require('jwt-simple');
const logger = require('winston');

const acl = require('../acl');
const scope = require('../scope');
const error = require('../modules/error')('ctrl', 'auth');
const settings = require('../modules/settings');
const config = settings.current;

const Redis = require('redis');
Promise.promisifyAll(Redis.RedisClient.prototype);
Promise.promisifyAll(Redis.Multi.prototype);
const redis = Redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
redis.select(config.vpdb.redis.db);
redis.on('error', err => logger.error(err.message));

const User = require('mongoose').model('User');
const Token = require('mongoose').model('Token');

/**
 * Protects a resource by verifying the JWT in the header or query param.
 * If `resource` and `permission` are set, ACLs are additionally checked.
 * If `plan` is set, must must be subscribed to that plan.
 *
 * In any case, the user must be logged. On success, the `req.user` object is
 * set so further down the stack you can read data from it. `res` is used for
 * setting the `X-Token-Refresh` header if necessary.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {string} [resource=null] ACL resource
 * @param {string} [permission=null] ACL permission
 * @param {string[]} [requiredScopes=null] Scopes, where, if set, at least one must match the current auth method's scopes.
 * @param {string} [planAttrs=null] key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
 * @returns Promise
 */
exports.auth = function(req, res, resource, permission, requiredScopes, planAttrs) {

	const vpdbUserIdHeader = 'x-vpdb-user-id';
	const providerUserIdHeader = 'x-user-id';
	const now = new Date();
	let token;
	let fromUrl = false;
	let headerName = config.vpdb.authorizationHeader;
	let user;
	delete req.user;

	return Promise.try(() => {

		// get token
		if ((req.headers && req.headers[headerName.toLowerCase()]) || (req.query && req.query.token)) {

			if (req.query.token) {
				fromUrl = true;
				token = req.query.token;

			} else {

				// validate format
				const parts = req.headers[headerName.toLowerCase()].split(' ');
				if (parts.length !== 2) {
					throw error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
				}
				const scheme = parts[0];
				const credentials = parts[1];
				if (!/^Bearer$/i.test(scheme)) {
					throw error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
				}
				fromUrl = false;
				token = credentials;
			}
		} else {
			throw error('Unauthorized. You need to provide credentials for this resource').status(401);
		}

		// app token?
		if (/[0-9a-f]{32,}/i.test(token)) {

			// application access tokens aren't allowed in the url
			if (fromUrl) {
				throw error('App tokens must be provided in the header.').status(401);
			}

			return Token.findOne({ token: token }).populate('_created_by').exec().then(appToken => {

				// fail if not found
				if (!appToken) {
					throw error('Invalid app token.').status(401);
				}

				// fail if incorrect plan
				if (appToken.type === 'personal' && !appToken._created_by.planConfig.enableAppTokens) {
					throw error('Your current plan "%s" does not allow the use of app tokens. Upgrade or contact an admin.', appToken._created_by.planConfig.id).status(401);
				}

				// fail if expired
				if (appToken.expires_at.getTime() < now.getTime()) {
					throw error('Token has expired.').status(401);
				}

				// fail if inactive
				if (!appToken.is_active) {
					throw error('Token is inactive.').status(401);
				}

				// so we're good here!
				req.appToken = appToken;
				req.tokenType = appToken.type;
				req.tokenScopes = appToken.scopes;

				// additional checks for application token
				if (appToken.type === 'application') {

					req.tokenProvider = appToken.provider;

					// if this resource is a service resource, we don't need a user ID. But make sure no permissions needed.
					if (requiredScopes && scope.isValid([ scope.SERVICE ], requiredScopes) && !resource && !permission) {
						return appToken.update({ last_used_at: new Date() }).then(() => null);
					}

					return Promise.try(() => {

						// vpdb user id header provided
						if (req.headers[vpdbUserIdHeader]) {
							return User.findOne({ id: req.headers[vpdbUserIdHeader] }).then(user => {
								if (!user) {
									throw new error('No user with ID "%s".', req.headers[vpdbUserIdHeader]).status(400);
								}
								if (!user.providers[appToken.provider]) {
									throw new error('Provided user has not been authenticated with %s.', appToken.provider).status(400);
								}
								return user;

							});
						}

						// oauth provider user id header provided
						const providerUserId = req.headers[providerUserIdHeader];
						if (providerUserId) {
							return User.findOne({ ['providers.' + appToken.provider + '.id' ]: String(providerUserId) }).then(user => {
								if (!user) {
									throw new error('No user with ID "%s" for provider "%s".', req.headers[providerUserIdHeader], appToken.provider).status(400);
								}
								return user;
							});
						}

						// if no user header found, fail.
						throw new error('Must provide "%s" or "%s" header when using application token.', vpdbUserIdHeader, providerUserIdHeader).status(400);

					}).then(user => appToken.update({ last_used_at: new Date() }).then(() => user));
				}
				return appToken.update({ last_used_at: new Date() }).then(() => appToken._created_by);
			});

		// Otherwise, assume it's a JWT.
		} else {

			// validate token
			let decoded;
			try {
				decoded = jwt.decode(token, config.vpdb.secret, false, 'HS256');
			} catch (e) {
				throw error(e, 'Bad JSON Web Token').status(401);
			}

			// check for expiration
			let tokenExp = new Date(decoded.exp);
			if (tokenExp.getTime() < now.getTime()) {
				throw error('Token has expired').status(401);
			}

			if (fromUrl && !decoded.path) {
				throw error('Tokens that are valid for any path cannot be provided as query parameter.').status(401);
			}

			// check for path && method
			let extPath = settings.intToExt(req.path);
			if (decoded.path && (decoded.path !== extPath || (req.method !== 'GET' && req.method !== 'HEAD'))) {
				throw error('Token is only valid for "GET/HEAD %s" but got "%s %s".', decoded.path, req.method, extPath).status(401);
			}

			return User.findOne({ id: decoded.iss }).then(user => {
				if (!user) {
					throw error('No user with ID %s found.', decoded.iss).status(403).log();
				}

				// generate new token if it's a short term token.
				let tokenIssued = new Date(decoded.iat);
				if (tokenExp.getTime() - tokenIssued.getTime() === config.vpdb.apiTokenLifetime) {
					res.setHeader('X-Token-Refresh', exports.generateApiToken(user, now, true));
				}
				req.tokenScopes = [ scope.ALL ];
				req.tokenType = decoded.irt ? 'jwt-refreshed' : 'jwt';
				return user;
			});
		}

	}).then(u => {
		user = u;

		// check scopes
		if (!scope.isValid(requiredScopes, req.tokenScopes)) {
			throw error('Your token has an invalid scope: [ "%s" ] (required: [ "%s" ])', (req.tokenScopes || []).join('", "'), (requiredScopes || []).join('", "')).status(401).log();
		}

		// user can be null for service resources
		if (user === null) {
			return;
		}

		// check plan config if provided
		if (_.isObject(planAttrs)) {
			for (let key in planAttrs) {
				if (planAttrs.hasOwnProperty(key)) {
					let val = planAttrs[key];
					if (user.planConfig[key] !== val) {
						throw error('User <%s> with plan "%s" tried to access `%s` but was denied access due to missing plan configuration (%s is %s instead of %s).',
							user.email, user._plan, req.url, key, val, user.planConfig[key]).display('Access denied').status(403).log();
					}
				}
			}
		}
		// *** here we're still authenticated (token is valid and not expired). ***

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').identify(req, { email: user.email });
		}

		// this will be useful for the rest of the stack
		req.user = user;

		// set dirty header if necessary
		return redis.getAsync('dirty_user_' + user.id).then(result => {
			if (result) {
				logger.info('[ctrl|auth] User <%s> is dirty, telling him in header.', user.email);
				res.setHeader('X-User-Dirty', result);
				return redis.delAsync('dirty_user_' + user.id);
			}
			res.setHeader('X-User-Dirty', 0);
		});

	}).then(() => {

		// no ACLs set, grant.
		if (!resource || !permission) {
			return;
		}

		// check ACL permissions
		return acl.isAllowed(user.id, resource, permission).then(granted => {
			if (!granted) {
				throw error('User <%s> tried to access `%s` but was denied access due to missing permissions to %s/%s.', user.email, req.url, resource, permission).display('Access denied').status(403).log();
			}
		});
	});
};

/**
 * Creates a JSON Web Token for a given user and time.
 * @param {object} user
 * @param {Date} now
 * @param {boolean} isRefreshToken If set, mark the token as refresh token (can't be used for creating login tokens)
 * @returns {string}
 */
exports.generateApiToken = function(user, now, isRefreshToken) {
	return jwt.encode({
		iss: user.id,
		iat: now,
		exp: new Date(now.getTime() + config.vpdb.apiTokenLifetime),
		irt: isRefreshToken
	}, config.vpdb.secret);
};

/**
 * Creates a media token.
 *
 * Media tokens are only valid for a given path and HTTP method and time out
 * much faster (default 1 minute).
 *
 * @param {object} user
 * @param {Date} now
 * @param {string} path
 * @returns {string}
 */
exports.generateStorageToken = function(user, now, path) {
	if (!path.startsWith('/')) {
		path = urlPath(path);
	}
	return jwt.encode({
		iss: user.id,
		iat: now,
		exp: new Date(now.getTime() + config.vpdb.storageTokenLifetime),
		path: path
	}, config.vpdb.secret);
};


function urlPath(url) {
	let u = require('url').parse(url);
	let q = u.search || '';
	let h = u.hash || '';
	return u.pathname + q + h;
}