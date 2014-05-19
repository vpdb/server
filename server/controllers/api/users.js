var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var User = require('mongoose').model('User');
var acl = require('../../acl');
var api = require('./common');

exports.fields = {
	pub: ['_id', 'name', 'username', 'thumb'],
	adm: ['email', 'active', 'roles']
};

exports.create = function(req, res) {

	var newUser = new User(req.body);
	newUser.provider = 'local';
	logger.info('[api|user:create] %s', util.inspect(req.body));
	newUser.validate(function(err) {
		if (err) {
			logger.warn('[api|user:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
			return api.fail(res, err, 422);
		}
		logger.info('[api|user:create] Validations passed, checking for existing user.');
		User.findOne({ email: newUser.email }).exec(function(err, user) {
			if (err) {
				logger.error('[api|user:create] Error finding user with email <%s>: %s', newUser.email, err, {});
				return api.fail(res, err);
			}
			if (!user) {
				// check if it's the first user
				User.count(function(err, count) {
					if (err) {
						logger.error('[api|user:create] Error counting users: %s', err, {});
						return api.fail(res, err, 500);
					}
					newUser.roles = count ? [ 'member' ] : [ 'root' ];
					newUser.save(function(err) {
						if (err) {
							logger.error('[api|user:create] Error saving user <%s>: %s', newUser.email, err, {});
							return api.fail(res, err, 500);
						}
						logger.info('[api|user:create] Success!');
						return api.success(res, _.omit(newUser.toJSON(), 'passwordHash', 'passwordSalt'), 201);
					});
				});
			} else {
				logger.warn('[api|user:create] User <%s> already in database, aborting.', newUser.email);
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
	User.findOne({ username: req.body.username }, '-__v', function(err, user) {
		if (err) {
			logger.error('[api|user:login] Error finding user "%s": %s', req.body.username, err, {});
			return api.fail(res, err, 500);
		}
		if (!user || !user.authenticate(req.body.password)) {
			logger.warn('[api|user:login] Login denied for user "%s" (%s).', req.body.username, user ? 'password' : 'username');
			return api.fail(res, 'Wrong username or password.', 401);
		}
		if (!user.active) {
			logger.warn('[api|user:login] Login denied for inactive user "%s".', req.body.username);
			return api.fail(res, 'Inactive account. Please contact an administrator.', 401);
		}
		req.logIn(user, function(err) {
			if (err) {
				logger.error('[api|user:login] Error logging in user <%s>: %s', user.email, err, {});
				return api.fail(res, err, 500);
			}
			logger.info('[api|user:login] User <%s> successfully logged in.', user.email);
			acl.allowedPermissions(req.user.email, [ 'users', 'content' ], function(err, permissions) {
				if (err) {
					logger.error('[api|user:login] Error reading permissions for user <%s>: %s', user.email, err, {});
					return api.fail(res, err, 500);
				}
				acl.userRoles(req.user.email, function(err, roles) {
					if (err) {
						logger.error('[api|user:login] Error reading roles for user <%s>: %s', user.email, err, {});
						return api.fail(res, err, 500);
					}
					return api.success(res, _.extend(
						_.omit(user.toJSON(), 'passwordHash', 'passwordSalt'),
						{
							permissions: permissions,
							rolesAll: roles
						}
					), 200);
				});
			});
		});
	});
};

exports.list = function(req, res) {
	api.auth(req, res, 'users', 'list', function() {
		var callback = function(err, users) {
			if (err) {
				logger.error('[api|user:list] Error: %s', err, {});
				return api.fail(res, err, 500);
			}
			// reduce
			users = _.map(users, function(user) {
				if (!_.isEmpty(user.github)) {
					user.github = _.pick(user.github, 'id', 'login', 'email', 'avatar_url', 'html_url');
				}
				return user;
			});
			api.success(res, users);
		};
		if (req.query.q) {
			var q = req.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
			var regex = new RegExp(q, 'i');
			User.find().select('-passwordHash -passwordSalt -__v').or([
				{ name: regex },
				{ username: regex },
				{ email: regex }
			]).exec(callback);
		} else {
			console.log('returning full result...');
			User.find({}, '-passwordHash -passwordSalt -__v', callback);
		}
	});
};

exports.update = function(req, res) {
	var updateableFields = [ 'name', 'email', 'username', 'active', 'roles' ];
	api.auth(req, res, 'users', 'update', function() {
		User.findById(req.params.id, '-passwordHash -passwordSalt -__v', function(err, user) {
			if (err) {
				logger.error('[api|user:update] Error: %s', err, {});
				return api.fail(res, err, 500);
			}
			var updatedUser = req.body;
			var originalEmail = user.email;

			// 1. check for permission escalation
			var callerRoles = req.user.roles;
			var currentUserRoles = user.roles;
			var updatedUserRoles = updatedUser.roles;

			var removedRoles = _.difference(currentUserRoles, updatedUserRoles);
			var addedRoles = _.difference(updatedUserRoles, currentUserRoles);

			// if caller is not root..
			if (!_.contains(callerRoles, 'root')) {

				logger.info('[api|user:update] Checking for privilage escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

				// if user to be updated is already root or admin, deny (unless it's the same user).
				if (!user._id.equals(req.user._id) && (_.contains(currentUserRoles, 'root') || _.contains(currentUserRoles, 'admin'))) {
					logger.error('[api|user:update] PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '));
					return api.fail(res, 'You are now allowed to update administrators or root users.', 403);
				}

				// if new roles contain root or admin, deny (even when removing)
				if (_.contains(addedRoles, 'root') || _.contains(addedRoles, 'admin') || _.contains(removedRoles, 'root') || _.contains(removedRoles, 'admin')) {
					logger.error('[api|user:update] PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '));
					return api.fail(res, 'You are now allowed change the admin or root role for anyone.', 403);
				}
			}

			// 2. copy over new values
			_.each(updateableFields, function(field) {
				user[field] = updatedUser[field];
			});

			// 3. validate
			user.validate(function(err) {
				if (err) {
					logger.warn('[api|user:update] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) {
						return key;
					})));
					return api.fail(res, err, 422);
				}
				logger.info('[api|user:update] Validations passed, updating user.');

				// 4. save
				user.save(function(err) {
					if (err) {
						logger.error('[api|user:update] Error updating user <%s>: %s', updatedUser.email, err, {});
						return api.fail(res, err, 500);
					}
					logger.info('[api|user:update] Success!');

					// 5. update ACLs if email or roles changed
					if (originalEmail != user.email) {
						logger.info('[api|user:update] Email changed, removing ACLs for <%s> and creating new ones for <%s>.', originalEmail, user.email);
						acl.removeUserRoles(originalEmail, '*');
						acl.addUserRoles(user.email, user.roles);

					} else {
						if (removedRoles.length > 0) {
							logger.info('[api|user:update] Updating ACLs: Removing roles [%s] from user <%s>.', removedRoles.join(' '), user.email);
							acl.removeUserRoles(user.email, removedRoles);
						}
						if (addedRoles.length > 0) {
							logger.info('[api|user:update] Updating ACLs: Adding roles [%s] to user <%s>.', addedRoles.join(' '), user.email);
							acl.addUserRoles(user.email, addedRoles);
						}
					}

					return api.success(res, user, 200);
				});
			});
		});
	});
};


exports.logout = function(req, res) {
	if (req.isAuthenticated()) {
		logger.info('[api|user:logout] Logging out user <%s>.', req.user.email);
		req.logout();
		api.success(res, { message: "You have been successfully logged out." }, 200);
	} else {
		logger.info('[api|user:logout] Tried to logout non-logged user, ignoring.');
		api.success(res, { message: "You have been already been logged out." }, 200);
	}
};