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

"use strict";

const _ = require('lodash');
const jwt = require('jwt-simple');
const logger = require('winston');

const acl = require('../acl');
const error = require('../modules/error')('ctrl', 'auth');
const settings = require('../modules/settings');
const config = settings.current;

const Redis = require('redis');
      Promise.promisifyAll(Redis.RedisClient.prototype);
      Promise.promisifyAll(Redis.Multi.prototype);
const redis = Redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
      redis.select(config.vpdb.redis.db);
      redis.on('error', console.error.bind(console));

const User = require('mongoose').model('User');

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
 * @param {string} [planAttrs=null] key/value pairs of plan options that must match, e.g. { enableAppTokens: false }
 * @returns Promise
 */
exports.auth = function(req, res, resource, permission, planAttrs) {

	const now = new Date();
	let token;
	let fromUrl = false;
	let headerName = config.vpdb.authorizationHeader;
	let tokenType, user;
	delete req.user;

	return Promise.try(() => {

		// read headers
		if ((req.headers && req.headers[ headerName.toLowerCase() ]) || (req.query && req.query.token)) {

			if (req.query.token) {
				fromUrl = true;
				token = req.query.token;
			} else {

				fromUrl = false;

				// validate format
				var parts = req.headers[ headerName.toLowerCase() ].split(' ');
				if (parts.length === 2) {
					var scheme = parts[ 0 ];
					var credentials = parts[ 1 ];
					if (/^Bearer$/i.test(scheme)) {
						token = credentials;
					} else {
						throw error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
					}
				} else {
					throw error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401);
				}
			}
		} else {
			throw error('Unauthorized. You need to provide credentials for this resource').status(401);
		}

		// application access token?
		if (/[0-9a-f]{32,}/i.test(token)) {

			// application access tokens aren't allowed in the url
			if (fromUrl) {
				throw error('Application Access Tokens must be provided in the header.').status(401);
			}

			return Token.findOne({ token: token }).populate('_created_by').exec().then(t => {

				// fail if not found
				if (!t) {
					throw error('Invalid access token.').status(401);
				}

				// fail if not access token
				if (t.type !== 'access') {
					throw error('Token must be an access token.').status(401);
				}

				// fail if incorrect plan
				if (!t._created_by.planConfig.enableAppTokens) {
					throw error('Your current plan "%s" does not allow the use of application access tokens. Upgrade or contact an admin.', t._created_by.planConfig.id).status(401);
				}

				// fail if expired
				if (t.expires_at.getTime() < now.getTime()) {
					throw error('Token has expired.').status(401);
				}

				// fail if inactive
				if (!t.is_active) {
					throw error('Token is inactive.').status(401);
				}

				// so we're good here!
				tokenType = 'access-token';
				return Token.update({ _id: t._id }, { last_used_at: new Date() }).then(() => t._created_by);
			});

		// Otherwise, assume it's a JWT.
		} else {

			// validate token
			let decoded;
			try {
				decoded = jwt.decode(token, config.vpdb.secret);
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

				tokenType = decoded.irt ? 'jwt-refreshed' : 'jwt';
				return user;
			});
		}

	}).then(u => {
		user = u;

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

		// this will be useful for the rest of the stack
		req.user = user;
		req.tokenType = tokenType; // one of: [ 'jwt', 'jwt-refreshed', 'access-token' ]

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

		return acl.isAllowed(user.id, resource, permission).then(granted => {
			if (!granted) {
				throw error('User <%s> tried to access `%s` but was denied access due to missing permissions to %s/%s.', user.email, req.url, resource, permission).display('Access denied').status(403).log();
			}
		});
	});
};

var Token = require('mongoose').model('Token');

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