"use strict";

var _ = require('underscore');
var logger = require('winston');

var ctrl = require('../ctrl');

/**
 * Protects a resource, meaning there must be valid JWT. If additionally
 * resource and permissions are provided, these are checked too.
 *
 * @param done Callback, called with (`req`, `res`). This is your API logic
 * @param resource ACL for resource
 * @param permission ACL for permission
 * @returns {Function} Middleware function
 */
exports.auth = function(done, resource, permission) {
	return ctrl.auth(resource, permission, function(err, req, res) {
		if (err) {
			return exports.fail(res, err.message, err.code);
		}
		done(req, res);
	}, false);
};


/**
 * Allows anonymous access, but still updates `req` with user if sent and
 * takes care of token invalidation.
 *
 * @param done Callback, called with (`req`, `res`). This is your API logic
 * @returns {Function} Middleware function
 */
exports.anon = function(done) {
	// auth is only called in order to populate the req.user object, if credentials are provided.
	return ctrl.auth(null, null, function(authErr, req, res) {
		// authErr is ignored since we're in anon.
		done(req, res);
	});
};


/**
 * Returns a JSON-serialized object to the client and a 200 status code.
 * @param res Response object
 * @param result Object to serialize
 * @param [code=200] HTTP status code (defaults to 200)
 */
exports.success = function(res, result, code) {
	if (!code) {
		code = 200;
	}
	if (result) {
		res.setHeader('Content-Type', 'application/json');
		res.status(code).json(result);
	} else {
		res.status(code).end();
	}
};


/**
 * Returns a JSON-serialized error object to the client and 500 status code per default.
 * @param res Response object
 * @param err Error message
 * @param [code=500] HTTP status code (defaults to 500)
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


exports.checkApiContentType = function(req, res, next) {
	if (req.path.substr(0, 5) === '/api/' && req.get('content-type') !== 'application/json') {
		res.setHeader('Content-Type', 'application/json');
		res.status(415).json({ error: 'Sorry, the API only talks JSON. Did you forget to set your "Content-Type" header correctly?' });
	} else {
		next(req, res, next);
	}
};

exports.handleParseError = function(err, req, res, next) {
	if (err instanceof SyntaxError && req.get('content-type') === 'application/json' && req.path.substr(0, 5) === '/api/') {
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
 * @param [rollback=null] Rollback function
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
		};
	};
};

/**
 * A helper method that replaces the "$" and "." character in order to be able
 * to store non-structured objects in MongoDB.
 *
 * @param object Object that is going to end up in MongoDB
 * @param [replacement=-] (optional) Replacement character
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
				delete object[oldProp];
			}
			if (typeof object[property] === "object"){
				exports.sanitizeObject(object[property]);
			}
		}
	}
};

exports.ping = function(req, res) {
	exports.success(res, { result: 'pong' });
};
