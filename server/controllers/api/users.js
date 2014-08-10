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
var util = require('util');
var logger = require('winston');
var redis = require('redis-mock').createClient();

var User = require('mongoose').model('User');
var acl = require('../../acl');
var api = require('./api');
var ctrl = require('../ctrl');
var config = require('../../modules/settings').current;


exports.create = function(req, res) {
	var newUser = _.extend(req.body, {
		provider: 'local'
	});

	// TODO make sure newUser.email is sane (comes from user directly)
	User.findOne({ email: newUser.email }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|user:create] Error finding user with email <%s>: %s', newUser.email, err, {});
			return api.fail(res, err);
		}
		if (user) {
			logger.warn('[api|user:create] User <%s> already in database, aborting.', newUser.email);
			return api.fail(res, 'User with email <' + newUser.email + '> already exists.', 409);
		}
		User.createUser(newUser, function(err, user, validationErr) {
			if (validationErr) {
				logger.warn('[api|user:create] Validations failed: %s', util.inspect(_.map(validationErr.errors, function(value, key) { return key; })));
				return api.fail(res, validationErr, 422);
			}
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, err, 500);
			}
			return api.success(res, user, 201);
		});
	});
};

exports.authenticate = function(req, res) {

	if (!req.body.username || !req.body.password) {
		logger.warn('[api|user:authenticate] Ignoring empty authentication request.');
		return api.fail(res, 'You must supply a username and password.', 400);
	}
	User.findOne({ username: req.body.username }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|user:authenticate] Error finding user "%s": %s', req.body.username, err, {});
			return api.fail(res, err, 500);
		}
		if (!user || !user.authenticate(req.body.password)) {
			logger.warn('[api|user:authenticate] Authentication denied for user "%s" (%s).', req.body.username, user ? 'password' : 'username');
			return api.fail(res, 'Wrong username or password.', 401);
		}
		if (!user.is_active) {
			logger.warn('[api|user:authenticate] Authentication denied for inactive user "%s".', req.body.username);
			return api.fail(res, 'Inactive account. Please contact an administrator.', 401);
		}

		var now = new Date();
		var expires = new Date(now.getTime() + config.vpdb.sessionTimeout);
		var token = ctrl.generateToken(user, now);

		logger.info('[api|user:authenticate] User <%s> successfully authenticated.', user.email);
		getACLs(user, function(err, acls) {
			/* istanbul ignore if  */
			if (err) {
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

exports.list = function(req, res) {

	acl.isAllowed(req.user.email, 'users', 'list', function(err, canList) {
		acl.isAllowed(req.user.email, 'users', 'full-details', function(err, fullDetails) {

			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, err, 500);
			}

			// if no list privileges, user must provide at least a 3-char search query.
			if (!canList && (!req.query.q || req.query.q.length < 3)) {
				return api.fail(res, 'Please provide a search query with at least three characters.', 403);
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
					logger.error('[api|user:list] Error: %s', err, {});
					return api.fail(res, err, 500);
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

exports.profile = function(req, res) {

	getACLs(req.user, function(err, acls) {
		if (err) {
			return api.fail(res, err, 500);
		}
		api.success(res, _.extend(req.user.toDetailed(), acls), 200);
	});
};

exports.update = function(req, res) {

	var updateableFields = [ 'name', 'email', 'username', 'is_active', 'roles' ];
	User.findOne({ id: req.params.id }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|user:update] Error: %s', err, {});
			return api.fail(res, err, 500);
		}
		if (!user) {
			return api.fail(res, 'No such user.', 404);
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
				logger.warn('[api|user:update] Validations failed: %s', JSON.stringify(_.map(err.errors, function(value, key) {
					return key;
				})));
				return api.fail(res, err, 422);
			}
			logger.info('[api|user:update] Validations passed, updating user.');

			// 4. save
			user.save(function(err) {
				/* istanbul ignore if  */
				if (err) {
					logger.error('[api|user:update] Error updating user <%s>: %s', updatedUser.email, err, {});
					return api.fail(res, err, 500);
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

exports.del = function(req, res) {

	User.findOne({ id: req.params.id }, function(err, user) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|user:delete] Error finding user "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		if (!user) {
			return api.fail(res, 'No such user.', 404);
		}
		user.remove(function(err) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[api|user:delete] Error deleting user <%s>: %s', user.email, err, {});
				return api.fail(res, err, 500);
			}
			acl.removeUserRoles(user.email, user.roles);
			logger.info('[api|user:delete] User <%s> successfully deleted.', user.email);
			res.status(204).end();
		});
	});
};

function getACLs(user, done) {

	acl.userRoles(user.email, function(err, roles) {
		if (err) {
			logger.error('[api|user:profile] Error reading roles for user <%s>: %s', user.email, err, {});
			return done(err);
		}
		acl.whatResources(roles, function(err, resources) {
			if (err) {
				logger.error('[api|user:profile] Error reading resources: %s', err, {});
				return done(err);
			}
			acl.allowedPermissions(user.email, _.keys(resources), function(err, permissions) {
				if (err) {
					logger.error('[api|user:profile] Error reading permissions for user <%s>: %s', user.email, err, {});
					return done(err);
				}
				return done(null, { permissions: permissions });
			});
		});
	});
}