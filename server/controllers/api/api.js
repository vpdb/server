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
var url = require('url');
var util = require('util');
var logger = require('winston');

var settings = require('../../modules/settings');
var auth = require('../auth');

/**
 * Protects a resource, meaning there must be valid JWT. If additionally
 * resource and permissions are provided, these are checked too.
 *
 * @param done Callback, called with (`req`, `res`). This is your API logic
 * @param resource ACL for resource
 * @param permission ACL for permission
 * @param plan key/value pairs of plan options that must match
 * @returns {Function} Middleware function
 */
exports.auth = function(done, resource, permission, plan) {
	return auth.auth(resource, permission, plan, function(err, req, res) {
		if (err) {
			return exports.fail(res, err, err.code);
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
	return auth.auth(null, null, null, function(authErr, req, res) {
		// authErr is ignored since we're in anon.
		done(req, res, authErr);
	});
};


/**
 * Returns a JSON-serialized object to the client and a 200 status code.
 * @param res Response object
 * @param result Object to serialize
 * @param [code=200] HTTP status code (defaults to 200)
 */
exports.success = function(res, result, code, opts) {
	opts = opts || {};
	if (!code) {
		code = 200;
	}
	if (opts.pagination) {
		var pageLinks = {};
		var currentUrl = url.parse(settings.apiHost() + res.req.url, true);
		delete currentUrl.search;
		var paginatedUrl = function(page, perPage) {
			currentUrl.query = _.extend(currentUrl.query, { page: page, per_page: perPage });
			return url.format(currentUrl);
		};

		var lastPage = Math.ceil(opts.pagination.count / opts.pagination.perPage);
		if (opts.pagination.page > 2) {
			pageLinks.first = paginatedUrl(1, opts.pagination.perPage);
		}
		if (opts.pagination.page > 1) {
			pageLinks.prev = paginatedUrl(opts.pagination.page - 1, opts.pagination.perPage);
		}
		if (opts.pagination.page < lastPage) {
			pageLinks.next = paginatedUrl(opts.pagination.page + 1, opts.pagination.perPage);
		}
		if (opts.pagination.page < lastPage - 1) {
			pageLinks.last = paginatedUrl(lastPage, opts.pagination.perPage);
		}

		if (_.values(pageLinks).length > 0) {
			res.setHeader('Link', _.values(_.map(pageLinks, function(link, rel) {
				return '<' + link + '>; rel="' + rel + '"';
			})).join(', '));
		}
		res.setHeader('X-List-Page', opts.pagination.page);
		res.setHeader('X-List-Size', opts.pagination.perPage);
		res.setHeader('X-List-Count', opts.pagination.count);
	}
	if (opts.headers) {
		_.keys(opts.headers).forEach(name => res.setHeader(name, opts.headers[name]));
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
 * @param {object} res Response object
 * @param {Err} err Error object
 * @param {number} [code=500] HTTP status code (defaults to 500)
 */
exports.fail = function(res, err, code) {

	Promise.try(() => {
		code = code || err.code || 500;
		res.setHeader('Content-Type', 'application/json');
		if (err.errs) {
			var arr = _.uniqWith(_.map(err.errs, (error, path) => {
				return {
					message: error.message,
					field: _.isArray(err.errs) ? error.path : path,
					value: error.value
				};
			}), _.isEqual);
			res.status(code).json({ errors: _.sortBy(arr, 'field') });
		} else {
			res.status(code).json({ error: err.msg() });
		}
	}).catch(err => logger.error(err.stack));
};

exports.checkApiContentType = function(req, res, next) {
	var hasBody = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH';

	// todo fix use config instead of "/api".
	if (req.path.substr(0, 5) !== '/api/') {
		return next();
	}

	if (hasBody && !req.get('content-type')) {
		return res.status(415).json({ error: 'You need to set the "Content-Type" header.' });
	}

	if (hasBody && !~req.get('content-type').indexOf('application/json')) {
		res.status(415).json({ error: 'Sorry, the API only talks JSON. Did you forget to set the "Content-Type" header correctly?' });
	} else {
		next();
	}
};

exports.handleParseError = function(err, req, res, next) {
	/* istanbul ignore else */
	if (err instanceof SyntaxError && req.get('content-type') === 'application/json' && req.path.substr(0, 5) === '/api/') {
		res.setHeader('Content-Type', 'application/json');
		res.status(400).json({ error: 'Parsing error: ' + err.message });
	} else {
		res.setHeader('Content-Type', 'application/json');
		res.status(500).json({ error: err.message });
		logger.error(err.stack);
	}
};

/**
 * Returns a helper method that checks for errors after a database statement. If rollback
 * is provided, it is executed on error.
 *
 * @param {function} error Error object
 * @param {string} [prefix] String appended to log tag
 * @param {*} ref First param passed to provided error message
 * @param {object} res Result object
 * @param {function} [rollback=null] Rollback function
 * @return {function}
 */
exports.assert = function(error, prefix, ref, res, rollback) {

	/**
	 * Returns a function that asserts the result received.
	 *
	 * @param {function} successFct Success function which is called with all args but the first
	 * @param {string} [message] Message logged and returned to the user. If not set, message from received error is sent.
	 * @return {function}
	 */
	return function(successFct, message) {

		/**
		 * Checks result and either calls `successFct` if first param is falsely or replies
		 * directly to client otherwise.
		 */
		return function() {
			var args = Array.prototype.slice.call(arguments);
			var err = args[0];
			/* istanbul ignore if */
			if (err) {
				if (rollback) {
					logger.error('[api|%s] ROLLING BACK.', prefix);
					rollback(function(rollbackErr) {
						if (rollbackErr) {
							error(rollbackErr, 'Error rolling back').log(prefix);
						} else {
							logger.error('[api|%s] Rollback successful.', prefix);
						}
						if (message) {
							exports.fail(res, error(err, message, ref).log(prefix));
						} else {
							exports.fail(res, err);
						}
					});
				} else {
					if (message) {
						exports.fail(res, error(err, message, ref).log(prefix));

					} else {
						exports.fail(res, err);
					}
					console.log(err);
					logger.error('[api|%s] Stack: %s', prefix, new Error().stack);
				}
			} else {
				args.shift();
				successFct.apply(null, args);
			}
		};
	};
};

/**
 * Returns the pagination object.
 *
 * @param {Request} req
 * @param {int} [defaultPerPage=10] Default number of items returned if not indicated - default 10.
 * @param {int} [maxPerPage=50] Maximal number of items returned if not indicated - default 50.
 * @return {{defaultPerPage: Number, maxPerPage: Number, page: Number, perPage: Number}}
 */
exports.pagination = function(req, defaultPerPage, maxPerPage) {
	return {
		defaultPerPage: defaultPerPage,
		maxPerPage: maxPerPage,
		page: Math.max(req.query.page, 1) || 1,
		perPage: Math.max(0, Math.min(req.query.per_page, maxPerPage)) || defaultPerPage
	};
};

/**
 * Adds item count to the pagination object.
 * @param {object} pagination
 * @param {int} count
 * @returns {object}
 */
exports.paginationOpts = function(pagination, count) {
	return { pagination: _.extend(pagination, { count: count }) };
};

exports.searchQuery = function(query) {
	if (query.length === 0) {
		return {};
	} else if (query.length === 1) {
		return query[0];
	} else {
		return { $and: query };
	}
};

exports.sortParams = function(req, defaultSort, map) {
	var key, order, mapOrder, sortBy = {};
	defaultSort = defaultSort || { title: 1 };
	map = map || {};
	if (req.query.sort) {
		var s = req.query.sort.match(/^(-?)([a-z0-9_-]+)+$/);
		if (s) {
			order = s[1] ? -1 : 1;
			key = s[2];
			if (map[key]) {
				s = map[key].match(/^(-?)([a-z0-9_.]+)+$/);
				key = s[2];
				mapOrder = s[1] ? -1 : 1;
			} else {
				mapOrder = 1;
			}
			sortBy[key] = mapOrder * order;
		} else {
			return defaultSort;
		}
	} else {
		return defaultSort;
	}
	return sortBy;
};

exports.checkReadOnlyFields = function(newObj, oldObj, allowedFields) {
	var errors = [];
	_.difference(_.keys(newObj), allowedFields).forEach(function(field) {
		var newVal, oldVal;

		// for dates we want to compare the time stamp
		if (oldObj[field] instanceof Date) {
			newVal = newObj[field] ? new Date(newObj[field]).getTime() : undefined;
			oldVal = oldObj[field] ? new Date(oldObj[field]).getTime() : undefined;

		// for objects, serialize first.
		} else if (_.isObject(oldObj[field])) {
			newVal = newObj[field] ? JSON.stringify(newObj[field]) : undefined;
			oldVal = oldObj[field] ? JSON.stringify(_.pick(oldObj[field], _.keys(newObj[field] || {}))) : undefined;

		// otherwise, take raw values.
		} else {
			newVal = newObj[field];
			oldVal = oldObj[field];
		}
		if (newVal && newVal !== oldVal) {
			errors.push({
				message: 'This field is read-only and cannot be changed.',
				path: field,
				value: newObj[field]
			});
		}
	});

	return errors.length ? errors : false;
};

/**
 * Handles errors returned from promises.
 *
 * Only logs when receiving a standard Error object, otherwise it assumes
 * the error has been logged if log-worthy.
 *
 * Can handle both custom and standard errors, so in a promise, you might do:
 *
 *    throw error(err, 'Error doing foo').log('foo');                           // results in a 500 with message "Error doing foo"
 *    throw error('Release with ID %s not found.', req.params.id).status(404);  // results in a 404 with message "Release with ..."
 *    throw error('Wrong password').display('Access denied').status(401);       // results in a 401 with message "Access denied" but logs "Wrong password" to the console.
 *    throw new Error('Internal server error.');                                // results in a 500 with message "Internal server error."
 *
 * @param {Response} res Response object
 * @param {Function} error Current error function
 * @param {string} message Error message if exception is generic
 * @param {RegExp|string} fieldPrefix In case of validation errors, strip this expression from the field name
 * @returns {Function} Function called by the promise with error object
 */
exports.handleError = function(res, error, message, fieldPrefix) {
	return function(err) {
		if (err.constructor && err.constructor.name === 'Err') {
			exports.fail(res, err);

		} else if (err.errors && err.constructor && err.constructor.name === 'MongooseError') {
			exports.fail(res, error('Validations failed. See below for details.').without(fieldPrefix).errors(err.errors).warn(), 422);

		/* istanbul ignore next: we always wrapp errors in Err. */
		} else {
			exports.fail(res, error(err, message).log());
			logger.error(err.stack);
		}
	};
};

exports.ping = function(req, res) {
	exports.success(res, { result: 'pong' });
};