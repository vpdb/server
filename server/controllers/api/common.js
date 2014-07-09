var _ = require('underscore');
var jwt = require('jwt-simple');
var util = require('util');
var logger = require('winston');

var acl = require('../../acl');
var config = require('../../modules/settings').current;
var User = require('mongoose').model('User');

/**
 * Returns a middleware function that protects a resource by verifying the JWT
 * in the header. If `resource` and `permission` are set, ACLs are additionally
 * checked.
 *
 * On success, the `req.user` object is additionally set.
 *
 * @param done Resource call in case of success
 * @param resource ACL resource
 * @param permission ACL permission
 * @returns {Function} Middleware function
 */
exports.auth = function(done, resource, permission) {
	return function(req, res) {
		var token;

		// read headers
		if (req.headers && req.headers.authorization) {

			// validate format
			var parts = req.headers.authorization.split(' ');
			if (parts.length == 2) {
				var scheme = parts[0];
				var credentials = parts[1];
				if (/^Bearer$/i.test(scheme)) {

					// set token
					token = credentials;

				} else {
					return exports.fail(res, { message: 'Bad Authorization header. Format is "Authorization: Bearer [token]"' }, 401);
				}
			} else {
				return exports.fail(res, { message: 'Bad Authorization header. Format is "Authorization: Bearer [token]"' }, 401);
			}
		} else {
			return exports.fail(res, { message: 'Unauthorized. You need to provide credentials for this resource.' }, 401);
		}

		// validate token
		try {
			var decoded = jwt.decode(token, config.vpdb.secret);
		} catch (e) {
			return exports.fail(res, { message: 'Bad JSON Web Token: ' + e.message }, 401)
		}

		// check for expiration
		var now = new Date();
		var tokenExp = new Date(decoded.exp);
		if (tokenExp.getTime() < now.getTime()) {
			return exports.fail(res, { message: 'JSON Web Token has expired.' }, 401);
		}

		// here we're authenticated (token is valid and not expired). So update user and check ACL if necessary
		User.findById(decoded.iss, '-__v', function(err, user) {
			if (err) {
				logger.error('[api|common:auth] Error finding user %s: %s', decoded.iss, err);
				return exports.fail(res, err, 500);
			}
			if (!user) {
				logger.error('[api|common:auth] No user with ID %s found.', decoded.iss);
				return exports.fail(res, err, 400);
			}

			// this will be useful for the rest of the stack
			req.user = user;

			// generate new token if it's a short term token.
			var tokenIssued = new Date(decoded.iat);
			if (tokenExp.getTime() - tokenIssued.getTime() == config.vpdb.sessionTimeout) {
				res.setHeader('X-Token-Refresh', exports.generateToken(user, now));
			}

			// check ACL if necessary
			if (resource && permission) {
				acl.isAllowed(user.email, resource, permission, function(err, granted) {
					if (err) {
						logger.error('[api|common:auth] Error checking ACLs for user "%s": %s', user.email, err);
						return exports.fail(res, err, 500);
					}
					if (granted) {
						done(req, res);
					} else {
						return exports.fail(res, { message: 'Access denied.' }, 403);
					}
				});
			} else {
				done(req, res);
			}
		});
	}
};

/**
 * Returns a JSON-serialized object to the client and a 200 status code.
 * @param res Response object
 * @param result Object to serialize
 * @param code (optional) HTTP status code (defaults to 200)
 */
exports.success = function(res, result, code) {
	if (!code) {
		code = 200;
	}
	res.setHeader('Content-Type', 'application/json');
	res.status(code).json(result);
};


/**
 * Returns a JSON-serialized error object to the client and 500 status code per default.
 * @param res Response object
 * @param err Error message
 * @param code (optional) HTTP status code (defaults to 500)
 */
exports.fail = function(res, err, code) {
	if (!code) {
		code = 500;
	}
	res.setHeader('Content-Type', 'application/json');
	if (err.errors) {
		var arr = [];
		_.each(err.errors, function(error) {
			arr.push({
				message: error.message,
				field: error.path,
				value: error.value
			});
		});
		res.status(code).json({ errors: arr });
	} else {
		res.status(code).json({ error: err instanceof Error ? err.message : err });
	}
};


/**
 * Returns a JSON Web Token for a given user and time.
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

exports.checkApiContentType = function(req, res, next) {
	if (req.path.substr(0, 5) == '/api/' && req.get('content-type') != 'application/json') {
		res.setHeader('Content-Type', 'application/json');
		res.status(415).json({ error: 'Sorry, the API only talks JSON. Did you forget to set your "Content-Type" header correctly?' });
	} else {
		next(req, res, next);
	}
};

exports.handleParseError = function(err, req, res, next) {
	if (err instanceof SyntaxError && req.get('content-type') == 'application/json' && req.path.substr(0, 5) == '/api/') {
		res.setHeader('Content-Type', 'application/json');
		res.status(400).json({ error: 'Parsing error: ' + err.message });
	} else {
		next(err, req, res, next);
	}
};

/**
 * Returns a helper method that checks for errors after a database statement. If rollback
 * is provided, it is executed on error.
 *
 * @param type Type of the module (for logging)
 * @param action Method of the module (for logging)
 * @param ref First param passed to provided error message
 * @param res Result object
 * @param rollback Rollback function
 * @returns {Function}
 */
exports.ok = function(type, action, ref, res, rollback) {
	return function(successFct, message) {
		return function(err, result) {
			if (err) {
				logger.error('[api|%s:%s] ' + message, type, action, ref, err, {});
				if (rollback) {
					logger.error('[api|%s:%s] ROLLING BACK.', type, action);
					rollback(function(rollbackErr) {
						if (rollbackErr) {
							logger.error('[api|%s:%s] Error rolling back: %s', type, action, rollbackErr);
						} else {
							logger.error('[api|%s:%s] Rollback successful.', type, action);
						}
						exports.fail(res, err);
					});
				} else {
					exports.fail(res, err);
				}
			} else {
				successFct(result);
			}
		}
	}
};

exports.passport = function(strategy, passport, web) {
	return function (req, res, next) {
		passport.authenticate(strategy, function (err, user, info) {
			if (err) {
				return next(err);
			}
			if (!user) {
				// TODO handle error
				return res.redirect('/');
			}
			// don't do a HTTP redirect because we need Angular read the JWT first
			web.index(false, false, {
				auth: {
					redirect: '/',
					jwt: exports.generateToken(user, new Date())
				}
			})(req, res);
		})(req, res, next);
	};
};

/**
 * A helper method that replaces the "$" and "." character in order to be able
 * to store non-structured objects in MongoDB.
 *
 * @param object Object that is going to end up in MongoDB
 * @param replacement (optional) Replacement character
 */
exports.sanitizeObject = function(object, replacement) {
	replacement = replacement || '-';
	var oldProp;
	for (var property in object) {
		if (object.hasOwnProperty(property)) {
			if (/\.|\$/.test(property)) {
				oldProp = property;
				property = oldProp.replace(/\.|\$/g, replacement);
				object[property] = object[oldProp];
				delete object[oldProp]
			}
			if (typeof object[property] == "object"){
				exports.sanitizeObject(object[property]);
			}
		}
	}
};