var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var User = require('mongoose').model('User');
var api = require('./common');

var fields = {
	pub: ['username', 'email', 'active', 'thumb'],
	adm: ['roles']
};

exports.create = function(req, res) {

	var newUser = new User(req.body);
	newUser.provider = 'local';
	logger.info('[api|user:create] %s', util.inspect(req.body));
	newUser.validate(function(err) {
		if (err) {
			logger.warn('[api|user:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key, list) { return key; })));
			return api.fail(res, err, 422);
		}
		logger.info('[api|user:create] Validations passed, checking for existing user.');
		User.findOne({ email: newUser.email }).exec(function(err, user) {
			if (err) {
				logger.error('[api|user:create] Error finding user with email "%s": %s', newUser.email, err);
				return api.fail(res, err);
			}
			if (!user) {
				// check if it's the first user
				User.count(function(err, count) {
					if (err) {
						logger.error('[api|user:create] Error counting users: %s', err);
						return api.fail(res, err, 500);
					}
					newUser.roles = count ? [ 'member' ] : [ 'god' ];
					newUser.save(function(err) {
						if (err) {
							logger.error('[api|user:create] Error saving user "%s": %s', newUser.email, err);
							return api.fail(res, err, 500);
						}
						logger.info('[api|user:create] Success!');
						return api.success(res, _.omit(newUser, 'passwordHash', 'salt'), 201);
					});
				});
			} else {
				logger.warn('[api|user:create] User "%s" already in database, aborting.', newUser.email);
				return api.fail(res, 'User with email "' + newUser.email + '" already exists.', 409);
			}
		});
	});
};

exports.login = function(req, res) {

	if (!req.body.username || !req.body.password) {
		logger.warn('[api|user:login] Ignoring empty login request.');
		return api.fail(res, 'You must supply a username and password.', 400)
	}
	User.findOne({ username: req.body.username }).exec(function(err, user) {
		if (err) {
			logger.error('[api|user:login] Error finding user "%s": %s', req.body.username, err);
			return api.fail(res, err, 500);
		}
		if (!user || !user.authenticate(req.body.password)) {
			logger.warn('[api|user:login] Login denied for user "%s" (%s).', req.body.username, user ? 'password' : 'username');
			return api.fail(res, 'Wrong username or password.', 401);
		}
		req.logIn(user, function(err) {
			if (err) {
				logger.error('[api|user:login] Error logging in user "%s": %s', user.email, err);
				return api.fail(res, err, 500);
			}
			logger.info('[api|user:login] User "%s" successfully logged in.', user.email);
			return api.success(res, _.pick(user, fields.pub), 200);
		});
	});
};

exports.list = function(req, res) {
	api.auth(req, res, 'users', 'list', function() {
		User.find({}, function(err, users) {
			if (err) {
				logger.error('[api|user:list] Error: %s', err);
				return api.fail(res, err, 500);
			}
			// reduce
			users = _.map(users, function(user) {
				return _.pick(user, fields.pub);
			});
			api.success(res, users);
		});
	});
};

exports.logout = function(req, res) {
	if (req.isAuthenticated()) {
		logger.info('[api|user:logout] Logging out user "%s".', req.user.email);
		req.logout();
		api.success(res, { message: "You have been successfully logged out." }, 200);
	} else {
		logger.info('[api|user:logout] Tried to logout non-logged user, ignoring.');
		api.success(res, { message: "You have been already been logged out." }, 200);
	}
};