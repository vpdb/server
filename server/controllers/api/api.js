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
	var hasBody = req.method === 'POST' || req.method === 'PUT' ||req.method === 'PATCH';
	if (req.path.substr(0, 5) === '/api/' && hasBody && req.get('content-type') !== 'application/json') {
		res.json(415, { error: 'Sorry, the API only talks JSON. Did you forget to set the "Content-Type" header correctly?' });
	} else {
		next();
	}
};

exports.handleParseError = function(err, req, res, next) {
	if (err instanceof SyntaxError && req.get('content-type') === 'application/json' && req.path.substr(0, 5) === '/api/') {
		res.setHeader('Content-Type', 'application/json');
		res.status(400).json({ error: 'Parsing error: ' + err.message });
	} else {
		next();
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
			/* istanbul ignore if */
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
