var _ = require('underscore');
var jwt = require('jwt-simple');
var redis = require('redis-mock').createClient();
var logger = require('winston');

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

		// read headers
		if ((req.headers && req.headers.authorization) || (req.query && req.query.jwt)) {

			if (req.query.jwt) {
				token = req.query.jwt;
			} else {

				// validate format
				var parts = req.headers.authorization.split(' ');
				if (parts.length == 2) {
					var scheme = parts[0];
					var credentials = parts[1];
					if (/^Bearer$/i.test(scheme)) {
						token = credentials;
					} else {
						return done({ code: 401, message: 'Bad Authorization header. Format is "Authorization: Bearer [token]"' }, req, res);
					}
				} else {
					return done({ code: 401, message: 'Bad Authorization header. Format is "Authorization: Bearer [token]"' }, req, res);
				}
			}

		} else {
			return done({ code: 401, message: 'Unauthorized. You need to provide credentials for this resource.' }, req, res);
		}

		// validate token
		try {
			var decoded = jwt.decode(token, config.vpdb.secret);
		} catch (e) {
			return done({ code: 401,  message: 'Bad JSON Web Token: ' + e.message }, req, res);
		}

		// check for expiration
		var now = new Date();
		var tokenExp = new Date(decoded.exp);
		if (tokenExp.getTime() < now.getTime()) {
			return done({ code: 401, message: 'JSON Web Token has expired.' }, req, res);
		}

		// here we're authenticated (token is valid and not expired). So update user and check ACL if necessary
		User.findById(decoded.iss, '-__v', function(err, user) {
			if (err) {
				logger.error('[ctrl|auth] Error finding user %s: %s', decoded.iss, err);
				return done({ code: 500, message: err }, req, res);
			}
			if (!user) {
				logger.error('[ctrl|auth] No user with ID %s found.', decoded.iss);
				return done({ code: 500, message: 'No user with ID ' + decoded.iss + ' found.' }, req, res);
			}

			// this will be useful for the rest of the stack
			req.user = user;

			// generate new token if it's a short term token.
			var tokenIssued = new Date(decoded.iat);
			if (tokenExp.getTime() - tokenIssued.getTime() == config.vpdb.sessionTimeout) {
				res.setHeader('X-Token-Refresh', exports.generateToken(user, now));
			}

			// set dirty header if necessary
			redis.get('dirty_user_' + user._id, function(err, result) {
				if (err) {
					logger.warn('[ctrl|auth] Error checking if user <%s> is dirty: %s', user.email, err);
				} else if (result) {
					logger.info('[ctrl|auth] User <%s> is dirty, telling him in header.', user.email);
					res.setHeader('X-User-Dirty', exports.generateToken(user, now));
				}

				// check ACL if necessary
				if (resource && permission) {
					acl.isAllowed(user.email, resource, permission, function(err, granted) {
						if (err) {
							logger.error('[ctrl|auth] Error checking ACLs for user <%s>: %s', user.email, err);
							return done({ code: 500, message: err }, req, res);
						}
						if (granted) {
							done(false, req, res);
						} else {
							return done({ code: 4.3, message: 'Access denied.' });
						}
					});
				} else {
					done(false, req, res);
				}

			});
		});
	}
};


/**
 * Creates a JSON Web Token for a given user and time.
 * @param user
 * @param now
 * @returns {*}
 */
exports.generateToken = function(user, now) {
	return jwt.encode({
		iss: user._id,
		iat: now,
		exp: new Date(now.getTime() + config.vpdb.sessionTimeout)
	}, config.vpdb.secret)
};


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
			ipboard: _.map(_.filter(config.vpdb.passport.ipboard, function(ipbConfig) { return ipbConfig.enabled }), function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		}
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
		if (req.originalUrl.substr(0, 5) == '/api/') {
			res.setHeader('Content-Type', 'application/json');
			res.status(code).end(JSON.stringify({ error: message }));

		// for partials, return a partial
		} else if (req.originalUrl.substr(0, 10) == '/partials/') {
			res.status(code).send('<h1>Oops!</h1><p>' + message + '</p>');

		// otherwise, return the full page.
		} else {
			exports.viewParams(req, function(params) {
				var tpl = _.contains([403, 404, 500, 502], code) ? code : '000';
				res.status(code).render('errors/' + tpl, _.extend(params, { url: req.originalUrl, code: code, message: message }));
			});
		}
	}
};