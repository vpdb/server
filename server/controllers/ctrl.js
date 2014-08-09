"use strict";

var _ = require('underscore');
var jwt = require('jwt-simple');
var redis = require('redis-mock').createClient();
var logger = require('winston');
var debug = require('debug')('auth');

var acl = require('../acl');
var assets = require('../config/assets');
var config = require('../modules/settings').current;
var gitinfo = require('../modules/gitinfo').info;

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
						return deny({ code: 401, message: 'Bad Authorization header. Format is "' + headerName + ': Bearer [token]"' });
					}
				} else {
					return deny({ code: 401, message: 'Bad Authorization header. Format is "' + headerName + ': Bearer [token]"' });
				}
			}

		} else {
			return deny({ code: 401, message: 'Unauthorized. You need to provide credentials for this resource.' });
		}

		// validate token
		var decoded;
		try {
			decoded = jwt.decode(token, config.vpdb.secret);
		} catch (e) {
			return deny({ code: 401,  message: 'Bad JSON Web Token: ' + e.message });
		}

		debug('1. %s %s - GOT TOKEN (%s)', req.method, req.path, decoded.iss);

		// check for expiration
		var now = new Date();
		var tokenExp = new Date(decoded.exp);
		if (tokenExp.getTime() < now.getTime()) {
			return deny({ code: 401, message: 'JSON Web Token has expired.' });
		}

		// here we're authenticated (token is valid and not expired). So update user and check ACL if necessary
		User.findOne({ id: decoded.iss }, '-__v', function(err, user) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[ctrl|auth] Error finding user %s: %s', decoded.iss, err);
				return deny({ code: 500, message: err });
			}
			if (!user) {
				logger.error('[ctrl|auth] No user with ID %s found.', decoded.iss);
				return deny({ code: 403, message: 'No user with ID ' + decoded.iss + ' found.' });
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
				if (resource && permission) {
					acl.isAllowed(user.email, resource, permission, function(err, granted) {
						/* istanbul ignore if  */
						if (err) {
							logger.error('[ctrl|auth] Error checking ACLs for user <%s>: %s', user.email, err);
							return deny({ code: 500, message: err });
						}
						if (granted) {
							done(false, req, res);
						} else {
							logger.warn('[ctrl|auth] User <%s> tried to access `%s` but was access denied due to missing permissions to %s/%s.', user.email, req.url, resource, permission);
							return deny({ code: 403, message: 'Access denied.' });
						}
					});
				} else {
					done(false, req, res);
				}
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
 * Appends the JWT to an url as query parameter, so protected non-api resources (such as storage)
 * can be accessed. The JWT is read from the response, so make sure you're in a call that went
 * through {@link exports.auth}.
 *
 * @param url Base URL
 * @param res Current response object
 * @returns {string}
 */
exports.appendToken = function(url, res) {
	var token = res.get('X-Token-Refresh');
	var sep = ~url.indexOf('?') ? '&' : '?';
	return token ? url + sep + 'jwt=' + token : url;
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

/**
 * Returns the parameter object that is accessible when rendering the views.
 * @param req Request object
 * @param done Callback, first parameter `params` object, no errors.
 */
exports.viewParams = function(req, done) {
	var params = {
		deployment: process.env.APP_NAME || 'staging',
		environment: process.env.NODE_ENV || 'development',
		gitinfo: gitinfo,
		jsFiles: assets.getJS(),
		cssFiles: assets.getCSS(),
		authStrategies: {
			local: true,
			github: config.vpdb.passport.github.enabled,
			ipboard: _.map(_.filter(config.vpdb.passport.ipboard, function(ipbConfig) { return ipbConfig.enabled; }), function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		},
		authHeader: config.vpdb.authorizationHeader
	};
	done(params);
};

/**
 * Renders an error. Depending of the path of the request, different
 * @param code
 * @param message
 * @returns {Function}
 */
exports.renderError = function(code, message) {
	return function(req, res) {

		// for API calls, return json
		if (req.originalUrl.substr(0, 5) === '/api/') {
			res.setHeader('Content-Type', 'application/json');
			res.status(code).send({ error: message });

		// for partials, return a partial
		} else if (req.originalUrl.substr(0, 10) === '/partials/') {
			// return 200 because otherwise angular doesn't render the partial view.
			res.status(200).send('<h1>Oops!</h1><p>' + message + '</p>');

		// otherwise, return the full page.
		} else {
			exports.viewParams(req, function(params) {
				var tpl = _.contains([403, 404, 500, 502], code) ? code : '000';
				res.status(code).render('errors/' + tpl, _.extend(params, { url: req.originalUrl, code: code, message: message }));
			});
		}
	};
};