/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var logger = require('winston');
var debug = require('debug')('auth');

var acl = require('../acl');
var error = require('../modules/error')('ctrl', 'auth').error;
var config = require('../modules/settings').current;

var redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
    redis.select(config.vpdb.redis.db);
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
 * @param done Callback. First argument is error containing `code` and `message`, followed by req and res.
 * @returns {Function} Middleware function
 */
exports.auth = function(resource, permission, done) {

	return function(req, res) {
		var token;
		var headerName = config.vpdb.authorizationHeader;
		delete req.user;

		var deny = function(error) {
			done(error, req, res);
		};

		// read headers
		if ((req.headers && req.headers[headerName.toLowerCase()]) || (req.query && req.query.jwt)) {

			if (req.query.jwt) {
				token = req.query.jwt;
			} else {

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

		// validate token
		var decoded;
		try {
			decoded = jwt.decode(token, config.vpdb.secret);
		} catch (e) {
			return deny(error(e, 'Bad JSON Web Token').status(401));
		}

		debug('1. %s %s - GOT TOKEN (%s)', req.method, req.path, decoded.iss);

		// check for expiration
		var now = new Date();
		var tokenExp = new Date(decoded.exp);
		if (tokenExp.getTime() < now.getTime()) {
			return deny(error('JSON Web Token has expired').status(401));
		}

		// here we're authenticated (token is valid and not expired). So update user and check ACL if necessary
		User.findOne({ id: decoded.iss }, '-__v', function(err, user) {
			/* istanbul ignore if  */
			if (err) {
				return deny(error(err, 'Error finding user "%s"', decoded.iss).status(500).log());
			}
			if (!user) {
				return deny(error('No user with ID %s found.', decoded.iss).status(403).log());
			}


			// this will be useful for the rest of the stack
			req.user = user;

			debug('2. %s %s - GOT USER <%s> (%s)', req.method, req.path, req.user.email, req.user.id);

			// generate new token if it's a short term token.
			var tokenIssued = new Date(decoded.iat);
			if (tokenExp.getTime() - tokenIssued.getTime() === config.vpdb.sessionTimeout) {
				res.setHeader('X-Token-Refresh', exports.generateToken(user, now, req.method + ' ' + req.path));
			}

			var checkACLs = function(err) {
				/* istanbul ignore if  */
				if (err) {
					logger.warn('[ctrl|auth] Error deleting dirty key from redis: %s', err);
				}

				// no ACLs set, grant.
				if (!resource || !permission) {
					return done(null, req, res);
				}

				acl.isAllowed(user.email, resource, permission, function(err, granted) {
					/* istanbul ignore if  */
					if (err) {
						return deny(error(err, 'Error checking ACLs for user <%s>', user.email).status(500).log());
					}

					if (!granted) {
						return deny(error('User <%s> tried to access `%s` but was denied access due to missing permissions to %s/%s.', user.email, req.url, resource, permission).display('Access denied').status(403).log());
					}
					done(null, req, res);
				});
			};

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
					return redis.del('dirty_user_' + user.id, checkACLs);
				}
				res.setHeader('X-User-Dirty', 0);
				checkACLs();
			});
		});
	};
};

/**
 * Creates a JSON Web Token for a given user and time.
 * @param user
 * @param now
 * @returns {*}
 */
exports.generateToken = function(user, now, dbg) {
	debug('3. %s - GEN-TOKEN <%s> (%s)', dbg, user.email, user.id);
	return jwt.encode({
		iss: user.id,
		iat: now,
		exp: new Date(now.getTime() + config.vpdb.sessionTimeout)
	}, config.vpdb.secret);
};

/**
 * Handles a passport callback from an authentication via OAuth2.
 *
 * @param strategy Strategy used
 * @param passport Passport module
 * @param web Web module
 * @returns {Function}
 */
exports.passport = function(strategy, passport, web) {
	/* istanbul ignore next */
	return function(req, res, next) {
		passport.authenticate(strategy, _passportCallback(web, req, res, next))(req, res, next);
	};
};

/**
 * Skips passport authentication and processes the user profile directly.
 * @param web Web controller
 * @returns {Function}
 */
exports.passportMock = function(web) {
	return function(req, res, next) {
		var profile = req.body.profile;
		if (profile) {
			profile._json = {
				_yes: 'This mock data and is more complete otherwise.',
				id: req.body.profile ? req.body.profile.id : null
			};
		}
		require('../passport').verifyCallbackOAuth(req.body.provider, req.body.providerName)(null, null, profile, _passportCallback(web, req, res, next));
	};
};

function _passportCallback(web, req, res, next) {
	return function(err, user) {
		if (err) {
			return next(err);
		}
		if (!user) {
			// TODO handle error
			return res.redirect('/');
		}
		// don't do a HTTP redirect because we need Angular to read the JWT first
		web.index({
			auth: {
				redirect: '/',
				jwt: exports.generateToken(user, new Date())
			}
		})(req, res);
	};
}
