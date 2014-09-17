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

var _ = require('lodash');
var logger = require('winston');
var passport = require('passport');

var User = require('mongoose').model('User');
var acl = require('../../acl');
var api = require('./api');
var auth = require('../auth');
var error = require('../../modules/error')('ctrl', 'user').error;
var config = require('../../modules/settings').current;
var redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
    redis.select(config.vpdb.redis.db);


/**
 * Creates a new user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.create = function(req, res) {

	var newUser = _.extend(req.body, {
		provider: 'local'
	});

	// TODO make sure newUser.email is sane (comes from user directly)
	User.findOne({ email: newUser.email }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding user with email <%s>', newUser.email).log('create'));
		}
		if (user) {
			return api.fail(res, error('User with email <%s> already exists.', newUser.email).warn('create'), 409);
		}
		User.createUser(newUser, function(err, user, validationErr) {
			if (validationErr) {
				return api.fail(res, error('Validations failed: %j', validationErr.errors).errors(validationErr.errors).warn('create'), 422);
			}
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, err, 500);
			}
			return api.success(res, user, 201);
		});
	});
};


/**
 * Authenticates a set of given credentials.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.authenticate = function(req, res) {

	if (!req.body.username || !req.body.password) {
		logger.warn('[api|user:authenticate] .');
		return api.fail(res, error('Ignored incomplete authentication request')
			.display('You must supply a username and password')
			.warn('authenticate'),
		400);
	}
	User.findOne({ username: req.body.username }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			// TODO check error message. We might not want to reveal too much here.
			return api.fail(res, error(err, 'Error while searching for "%s"', req.body.username).log('authenticate'), 500);
		}
		if (!user || !user.authenticate(req.body.password)) {
			return api.fail(res, error('Authentication denied for user "%s" (%s)', req.body.username, user ? 'password' : 'username')
					.display('Wrong username or password')
					.warn('authenticate'),
				401);
		}
		if (!user.is_active) {
			return api.fail(res, error('User <%s> is disabled, refusing access', user.email)
				.display('Inactive account. Please contact an administrator')
				.warn('authenticate'),
			401);
		}

		var now = new Date();
		var expires = new Date(now.getTime() + config.vpdb.sessionTimeout);
		var token = auth.generateToken(user, now);

		logger.info('[api|user:authenticate] User <%s> successfully authenticated.', user.email);
		getACLs(user, function(err, acls) {
			/* istanbul ignore if  */
			if (err) {
				// TODO check if it's clever to reveal anything here
				return api.fail(res, err, 500);
			}
			api.success(res, {
				token: token,
				expires: expires,
				user: _.extend(user.toSimple(), acls)
			}, 200);
		});
	});
};


/**
 * Authentication route for third party strategies.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 * @param {function} next
 */
exports.authenticateOAuth2 = function(req, res, next) {

	// use passport with a custom callback: http://passportjs.org/guide/authenticate/
	passport.authenticate(req.params.strategy, function(err, user, info) {
		if (err) {
			return api.fail(res, error(err, 'Authentication via %s failed: %j', req.params.strategy, err.oauthError)
				.warn('authenticate', req.params.strategy),
			401);
		}
		if (!user) {
			return api.fail(res, error('No user object in passport callback. More info: %j', info)
				.display('Could not retrieve user from %s.', req.params.strategy)
				.log('authenticate', req.params.strategy),
			500);
		}

		var now = new Date();
		var expires = new Date(now.getTime() + config.vpdb.sessionTimeout);
		var token = auth.generateToken(user, now);

		logger.info('[api|%s:authenticate] User <%s> successfully authenticated.', req.params.strategy, user.email);
		getACLs(user, function(err, acls) {
			/* istanbul ignore if  */
			if (err) {
				// TODO check if it's clever to reveal anything here
				return api.fail(res, err, 500);
			}
			api.success(res, {
				token: token,
				expires: expires,
				user: _.extend(user.toSimple(), acls)
			}, 200);
		});
	})(req, res, next);
};


/**
 * Lists users.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.list = function(req, res) {

	acl.isAllowed(req.user.email, 'users', 'list', function(err, canList) {
		acl.isAllowed(req.user.email, 'users', 'full-details', function(err, fullDetails) {

			/* istanbul ignore if  */
			if (err) {
				// TODO check if it's clever to reveal anything here
				return api.fail(res, error(err, 'Error checking ACLs').log('list'), 500);
			}

			// if no list privileges, user must provide at least a 3-char search query.
			if (!canList && (!req.query.q || req.query.q.length < 3)) {
				return api.fail(res, error('Please provide a search query with at least three characters.'), 403);
			}

			var query = User.find();

			// text search
			if (req.query.q) {
				// sanitize and build regex
				var q = req.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
				var regex = new RegExp(q, 'i');
				if (canList) {
					query.or([
						{ name: regex },
						{ username: regex },
						{ email: regex }
					]);
				} else {
					query.or([
						{ name: regex },
						{ username: regex }
					]);
				}
			}

			// filter by role
			if (canList && req.query.roles) {
				// sanitze and split
				var roles = req.query.roles.trim().replace(/[^a-z0-9,]+/gi, '').split(',');
				query.where('roles').in(roles);
			}

			query.exec(function(err, users) {
				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error listing users').log('list'), 500);
				}

				// reduce
				users = _.map(users, function(user) {
					return fullDetails ? user.toSimple() : user.toReduced();
				});
				api.success(res, users);
			});
		});
	});
};


/**
 * Returns the current user's profile.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.profile = function(req, res) {

	getACLs(req.user, function(err, acls) {
		if (err) {
			// TODO check if it's clever to reveal anything here
			return api.fail(res, err, 500);
		}
		api.success(res, _.extend(req.user.toDetailed(), acls), 200);
	});
};


/**
 * Updates an existing user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.update = function(req, res) {

	var updateableFields = [ 'name', 'email', 'username', 'is_active', 'roles' ];
	User.findOne({ id: req.params.id }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding user "%s"', req.params.id).log('update'), 500);
		}
		if (!user) {
			return api.fail(res, error('No such user.'), 404);
		}
		var updatedUser = req.body;
		var originalEmail = user.email;

		// 1. check for permission escalation
		var callerRoles = req.user.roles || [];
		var currentUserRoles = user.roles || [];
		var updatedUserRoles = updatedUser.roles || [];

		var removedRoles = _.difference(currentUserRoles, updatedUserRoles);
		var addedRoles = _.difference(updatedUserRoles, currentUserRoles);

		// if caller is not root..
		if (!_.contains(callerRoles, 'root')) {

			logger.info('[api|user:update] Checking for privilage escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(req.user._id) && (_.contains(currentUserRoles, 'root') || _.contains(currentUserRoles, 'admin'))) {
				return api.fail(res, error('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
					.display('You are not allowed to update administrators or root users.')
					.log('update'),
				403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (_.contains(addedRoles, 'root') || _.contains(addedRoles, 'admin') || _.contains(removedRoles, 'root') || _.contains(removedRoles, 'admin')) {
				return api.fail(res, error('PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '))
					.display('You are not allowed change the admin or root role for anyone.')
					.log('update'),
				403);
			}
		}

		// 2. copy over new values
		_.each(updateableFields, function(field) {
			user[field] = updatedUser[field];
		});

		// 3. validate
		user.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed: %j', err.errors).errors(err.errors).warn('create'), 422);
			}
			logger.info('[api|user:update] Validations passed, updating user.');

			// 4. save
			user.save(function(err) {
				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error updating user <%s>', updatedUser.email).log('update'), 500);
				}
				logger.info('[api|user:update] Success!');

				// 5. update ACLs if email or roles changed
				if (originalEmail !== user.email) {
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

				// 6. if changer is not changed user, mark user as dirty
				if (!req.user._id.equals(user._id)) {
					logger.info('[api|user:update] Marking user <%s> as dirty.', user.email);
					redis.set('dirty_user_' + user.id, new Date().getTime(), function() {
						redis.expire('dirty_user_' + user.id, 10000, function() {
							api.success(res, user.toSimple(), 200);
						});
					});
				} else {
					api.success(res, user.toSimple(), 200);
				}
			});
		});
	});
};


/**
 * Deletes an existing user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.del = function(req, res) {

	User.findOne({ id: req.params.id }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding user "%s"', req.params.id).log('delete'), 500);
		}
		if (!user) {
			return api.fail(res, error('No such user.'), 404);
		}
		user.remove(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error deleting user <%s>', user.email).log('delete'), 500);
			}
			acl.removeUserRoles(user.email, user.roles);
			logger.info('[api|user:delete] User <%s> successfully deleted.', user.email);
			res.status(204).end();
		});
	});
};

/**
 * Returns the ACLs for a given user.
 *
 * @param {User} user
 * @param {function} done done(Error, object}
 */
function getACLs(user, done) {

	acl.userRoles(user.email, function(err, roles) {
		if (err) {
			return done(error(err, 'Error reading roles for user <%s>', user.email).log('profile'));
		}
		acl.whatResources(roles, function(err, resources) {
			if (err) {
				return done(error(err, 'Error reading resources').log('profile'));
			}
			acl.allowedPermissions(user.email, _.keys(resources), function(err, permissions) {
				if (err) {
					return done(error(err, 'Error reading permissions for user <%s>', user.email).log('profile'));
				}
				return done(null, { permissions: permissions });
			});
		});
	});
}