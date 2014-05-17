var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var acl = require('../../acl');
var User = require('mongoose').model('User');

exports.auth = function(req, res, resource, permission, next) {

	// next is passed as second arg, meaning no auth necessary (public api)
	if (_.isFunction(resource)) {
		resource();
	} else {

		var check = function(email) {
			acl.isAllowed(email, resource, permission, function(err, granted) {
				if (err) {
					logger.error('[api|common:auth] Error checking ACLs for user "%s": %s', email, err);
					return exports.fail(res, err, 500);
				}
				if (granted) {
					next(email);
				} else {
					exports.fail(res, { message: 'Access denied.' }, 403);
				}
			});
		};
		if (req.isAuthenticated()) {
			check(req.user.email);
		} else {

			// read basic auth params from header
			var authorization = req.headers.authorization;
			if (!authorization) {
				return exports.fail(res, { message: 'Unauthorized. You need to provide credentials for this resource.' }, 401);
			}
			var parts = authorization.split(' ');
			if (parts[0] != 'Basic') {
				return exports.fail(res, { message: 'Only HTTP Basic authentication is supported at the moment.' }, 401);
			}
			var credentials = new Buffer(parts[1], 'base64').toString().split(':');
			var username = credentials[0];
			var password = credentials[1];

			if (!username || !password) {
				return exports.fail(res, { message: 'Must provide credentials.' }, 401);
			}

			// authenticate credentials
			User.findOne({ username: username }).exec(function(err, user) {
				if (err) {
					logger.error('[api|common:auth] Error finding user "%s": %s', username, err);
					return exports.fail(res, err, 500);
				}
				if (!user || !user.authenticate(password)) {
					logger.warn('[api|common:auth] Basic auth credentials denied for user "%s" (%s).', username, user ? 'password' : 'username');
					return exports.fail(res, { message: 'Invalid credentials.' }, 401);
				}
				check(user.email);
			});
		}
	}
};

exports.success = function(res, result, code) {
	if (!code) {
		code = 200;
	}
	res.setHeader('Content-Type', 'application/json');
	res.status(code).json(result);
};

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
