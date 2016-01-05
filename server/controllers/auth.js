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

var _ = require('lodash');
var jwt = require('jwt-simple');
var async = require('async');
var logger = require('winston');

var acl = require('../acl');
var error = require('../modules/error')('ctrl', 'auth');
var config = require('../modules/settings').current;

var redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
    redis.select(config.vpdb.redis.db);
	redis.on('error', console.error.bind(console));
var User = require('mongoose').model('User');

/**
 * Returns a middleware function that protects a resource by verifying the JWT
 * in the header or query param. If `resource` and `permission` are set, ACLs
 * are additionally checked.
 *
 * In any case, the user must be logged. On success, the `req.user` object is
 * set so further down the stack you can read data from it.
 *
 * @param resource ACL resource
 * @param permission ACL permission
 * @param plan key/value pairs of plan options that must match
 * @param done Callback. First argument is error containing `code` and `message`, followed by req and res.
 * @returns {Function} Middleware function
 */
exports.auth = function(resource, permission, plan, done) {

	return function(req, res) {
		var token;
		var fromUrl = false;
		var headerName = config.vpdb.authorizationHeader;
		delete req.user;

		var deny = function(error) {
			done(error, req, res);
		};

		// read headers
		if ((req.headers && req.headers[headerName.toLowerCase()]) || (req.query && req.query.token)) {

			if (req.query.token) {
				fromUrl = true;
				token = req.query.token;
			} else {

				fromUrl = false;

				// validate format
				var parts = req.headers[headerName.toLowerCase()].split(' ');
				if (parts.length === 2) {
					var scheme = parts[0];
					var credentials = parts[1];
					if (/^Bearer$/i.test(scheme)) {
						token = credentials;
					} else {
						return deny(error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401));
					}
				} else {
					return deny(error('Bad Authorization header. Format is "%s: Bearer [token]"', headerName).status(401));
				}
			}
		} else {
			return deny(error('Unauthorized. You need to provide credentials for this resource').status(401));
		}

		var now = new Date();
		async.waterfall([

			/**
			 * Validates the token and provides the user
			 */
			function(next) {

				// application access token?
				if (/[0-9a-f]{32,}/i.test(token)) {

					// application access tokens aren't allowed in the url
					if (fromUrl) {
						return next(error('Application Access Tokens must be provided in the header.').status(401));
					}

					Token.findOne({ token: token }).populate('_created_by').exec(function(err, t) {
						/* istanbul ignore if  */
						if (err) {
							return next(error(err, 'Error retrieving access token from DB.').status(500).log());
						}

						// fail if not found
						if (!t) {
							return next(error('Invalid access token.').status(401));
						}

						// fail if not access token
						if (t.type !== 'access') {
							return next(error('Token must be an access token.').status(401));
						}

						// fail if incorrect plan
						if (!config.vpdb.quota.plans[t._created_by._plan].enableAppTokens) {
							return next(error('Your current plan "%s" does not allow the use of application access tokens. Upgrade or contact an admin.', t._created_by._plan).status(401));
						}

						// fail if expired
						if (t.expires_at.getTime() < now.getTime()) {
							return next(error('Token has expired.').status(401));
						}

						// fail if inactive
						if (!t.is_active) {
							return next(error('Token is inactive.').status(401));
						}

						// so we're good here!
						Token.update({ _id: t._id }, { last_used_at: new Date() }, function(err) {
							if (err) {
								logger.warn('[ctrl|auth] Error saving last used time of token: %s', err.message);
							}
							next(null, t._created_by, 'access-token');
						});
					});

				// Otherwise, assume it's a JWT.
				} else {

					// validate token
					var decoded;
					try {
						decoded = jwt.decode(token, config.vpdb.secret);
					} catch (e) {
						return next(error(e, 'Bad JSON Web Token').status(401));
					}

					// check for expiration
					var tokenExp = new Date(decoded.exp);
					if (tokenExp.getTime() < now.getTime()) {
						return next(error('Token has expired').status(401));
					}

					if (fromUrl && !decoded.path) {
						return next(error('Tokens that are valid for any path cannot be provided as query parameter.').status(401));
					}

					// check for path && method
					if (decoded.path && (decoded.path !== req.path || (req.method !== 'GET' && req.method !== 'HEAD'))) {
						return next(error('Token is only valid for "GET/HEAD %s" but got "%s %s".', decoded.path, req.method, req.path).status(401));
					}

					User.findOne({ id: decoded.iss }, function(err, user) {
						/* istanbul ignore if  */
						if (err) {
							return next(error(err, 'Error finding user "%s"', decoded.iss).status(500).log());
						}
						if (!user) {
							return next(error('No user with ID %s found.', decoded.iss).status(403).log());
						}

						// generate new token if it's a short term token.
						var tokenIssued = new Date(decoded.iat);
						if (tokenExp.getTime() - tokenIssued.getTime() === config.vpdb.apiTokenLifetime) {
							res.setHeader('X-Token-Refresh', exports.generateApiToken(user, now, true));
						}

						next(null, user, decoded.irt ? 'jwt-refreshed' : 'jwt');
					});
				}

			/**
			 * Checks plan config if provided
			 */
			}, function(user, tokenType, next) {

				if (_.isObject(plan)) {
					for (var key in plan) {
						if (plan.hasOwnProperty(key)) {
							var val = plan[key];
							if (config.vpdb.quota.plans[user._plan][key] !== val) {
								return next(error('User <%s> with plan "%s" tried to access `%s` but was denied access due to missing plan configuration (%s is %s instead of %s).',
										user.email, user._plan, req.url, key, val, config.vpdb.quota.plans[user._plan][key]).display('Access denied').status(403).log());
							}
						}
					}
				}
				return next(null, user, tokenType);

			/**
			 * Sets dirty header
			 */
			}, function(user, tokenType, next) {

				// *** here we're still authenticated (token is valid and not expired). ***

				// this will be useful for the rest of the stack
				req.user = user;
				req.tokenType = tokenType; // one of: [ 'jwt', 'jwt-refreshed', 'access-token' ]

				// set dirty header if necessary
				redis.get('dirty_user_' + user.id, function(err, result) {
					/* istanbul ignore if  */
					if (err) {
						logger.warn('[ctrl|auth] Error checking if user <%s> is dirty: %s', user.email, err);
						return;
					}
					if (result) {
						logger.info('[ctrl|auth] User <%s> is dirty, telling him in header.', user.email);
						res.setHeader('X-User-Dirty', result);
						return redis.del('dirty_user_' + user.id, function(err) {
							/* istanbul ignore if  */
							if (err) {
								logger.warn('[ctrl|auth] Error deleting dirty key from redis: %s', err);
							}
							next(null, user);
						});
					}
					res.setHeader('X-User-Dirty', 0);
					next(null, user);
				});

			/**
			 * Checks ACLs
			 */
			}, function(user, next) {

				// no ACLs set, grant.
				if (!resource || !permission) {
					return next();
				}

				acl.isAllowed(user.id, resource, permission, function(err, granted) {
					/* istanbul ignore if  */
					if (err) {
						return next(error(err, 'Error checking ACLs for user <%s>', user.email).status(500).log());
					}

					if (!granted) {
						return next(error('User <%s> tried to access `%s` but was denied access due to missing permissions to %s/%s.', user.email, req.url, resource, permission).display('Access denied').status(403).log());
					}
					next();
				});
			}

		], function(err) {
			if (err) {
				return done(err, req, res);
			}
			done(null, req, res);
		});
	};
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
 * @paran {string} path
 * @returns {string}
 */
exports.generateStorageToken = function(user, now, path) {
	return jwt.encode({
		iss: user.id,
		iat: now,
		exp: new Date(now.getTime() + config.vpdb.storageTokenLifetime),
		path: path
	}, config.vpdb.secret);
};
