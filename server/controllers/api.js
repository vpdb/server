var _ = require('underscore');
var util = require('util');
var logger = require('winston');
var mongoose = require('mongoose');

var User = mongoose.model('User');

exports.userCreate = function(req, res) {

	var newUser = new User(req.body);
	newUser.provider = 'local';
	logger.info('[api|user:create] %s', util.inspect(req.body));
	newUser.validate(function(err) {
		if (err) {
			logger.warn('[api|user:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key, list) { return key; })));
			return fail(res, err, 422);
		}
		logger.info('[api|user:create] Validations passed, checking for existing user.');
		User.findOne({ email: newUser.email }).exec(function(err, user) {
			if (err) {
				logger.error('[api|user:create] Error finding user with email "%s": %s', newUser.email, err);
				return fail(res, err);
			}
			if (!user) {
				newUser.save(function(err) {
					if (err) {
						logger.error('[api|user:create] Error saving user "%s": %s', newUser.email, err);
						return fail(res, err, 500);
					}
					logger.info('[api|user:create] Success!');
					return success(res, _.omit(newUser, 'passwordHash', 'salt'), 201);
				});

			} else {
				logger.warn('[api|user:create] User "%s" already in database, aborting.', newUser.email);
				return fail(res, 'User with email "' + newUser.email + '" already exists.', 409);
			}
		});
	});
};

exports.userLogin = function(req, res) {

	if (!req.body.username || !req.body.password) {
		logger.warn('[api|user:login] Ignoring empty login request.');
		return fail(res, 'You must supply a username and password.', 400)
	}
	User.findOne({ username: req.body.username }).exec(function(err, user) {
		if (err) {
			logger.error('[api|user:login] Error finding user with email "%s": %s', req.body.username, err);
			return fail(res, err, 500);
		}
		if (!user || !user.authenticate(req.body.password)) {
			logger.warn('[api|user:login] Login denied for user "%s" (%s).', req.body.username, user ? 'password' : 'username');
			return fail(res, 'Wrong username or password.', 401);
		}
		req.logIn(user, function(err) {
			if (err) {
				logger.error('[api|user:login] Error logging in user "%s": %s', user.email, err);
				return fail(res, err, 500);
			}
			logger.info('[api|user:login] User "%s" successfully logged in.', user.email);
			return success(res, _.pick(user, 'username', 'email', 'active', 'thumb'), 200);
		});
	});
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

function success(res, result, code) {
	if (!code) {
		code = 200;
	}
	res.setHeader('Content-Type', 'application/json');
	res.status(code).json(_.omit(result, '__v'));
}

function fail(res, err, code) {
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
}