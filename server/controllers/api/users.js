/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var User = require('mongoose').model('User');
var LogUser = require('mongoose').model('LogUser');

var acl = require('../../acl');
var api = require('./api');
var error = require('../../modules/error')('api', 'users');
var mailer = require('../../modules/mailer');
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

	var newUser = _.extend(_.pick(req.body, 'username', 'password', 'email'), {
		provider: 'local'
	});

	// api test behavior
	var testMode = process.env.NODE_ENV === 'test';
	var skipEmailConfirmation = testMode && req.body.skipEmailConfirmation;

	var assert = api.assert(error, 'create', newUser.email, res);

	// TODO make sure newUser.email is sane (comes from user directly)
	User.findOne({ email: newUser.email }, assert(function(user) {

		if (user) {
			return api.fail(res, error('User with email <%s> already exists.', newUser.email).warn('create'), 409);
		}
		var confirmUserEmail = config.vpdb.email.confirmUserEmail && !skipEmailConfirmation;
		User.createUser(newUser, confirmUserEmail, assert(function(user, validationErr) {
			if (validationErr) {
				return api.fail(res, error('Validations failed. See below for details.').errors(validationErr.errors).warn('create'), 422);
			}

			// return result now and send email afterwards
			if (testMode && req.body.returnEmailToken) {
				api.success(res, _.extend(user.toDetailed(), { email_token: user.email_status.token }), 201);
			} else {
				api.success(res, user.toDetailed(), 201);
			}

			LogUser.success(req, user, 'registration', { provider: 'local', email: newUser.email, username: newUser.username });

			// user validated and created. time to send the activation email.
			if (config.vpdb.email.confirmUserEmail) {
				mailer.registrationConfirmation(user);
			}

		}, 'Error creating user <%s>.'));
	}, 'Error finding user with email <%s>'));
};


/**
 * Lists users.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.list = function(req, res) {

	var assert = api.assert(error, 'list', null, res);
	acl.isAllowed(req.user.id, 'users', 'list', assert(function(canList) {
		acl.isAllowed(req.user.id, 'users', 'full-details', assert(function(fullDetails) {

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
			if (req.query.name) {
				query.where('name').equals(req.query.name);
			}

			// filter by role
			if (canList && req.query.roles) {
				// sanitze and split
				var roles = req.query.roles.trim().replace(/[^a-z0-9,]+/gi, '').split(',');
				query.where('roles').in(roles);
			}

			query.exec(assert(function(users) {
				// reduce
				users = _.map(users, function(user) {
					return fullDetails ? user.toSimple() : user.toReduced();
				});
				api.success(res, users);

			}, 'Error listing users'));

		}, 'Error checking for ACL "users/full-details"'));
	}, 'Error checking for ACL "users/list".'));
};


/**
 * Updates an existing user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.update = function(req, res) {

	// TODO move into model
	var updateableFields = [ 'name', 'email', 'username', 'is_active', 'roles' ];
	var assert = api.assert(error, 'update', req.params.id, res);

	User.findOne({ id: req.params.id }, assert(function(user) {
		if (!user) {
			return api.fail(res, error('No such user.'), 404);
		}
		var updatedUser = req.body;

		// 1. check for changed read-only fields
		var readOnlyFieldErrors = api.checkReadOnlyFields(req.body, user, updateableFields);
		if (readOnlyFieldErrors) {
			return api.fail(res, error('User tried to update read-only fields').errors(readOnlyFieldErrors).warn('update'), 422);
		}

		// 2. check for permission escalation
		var callerRoles = req.user.roles || [];
		var currentUserRoles = user.roles || [];
		var updatedUserRoles = updatedUser.roles || [];

		var removedRoles = _.difference(currentUserRoles, updatedUserRoles);
		var addedRoles = _.difference(updatedUserRoles, currentUserRoles);

		var diff = LogUser.diff(_.pick(user.obj(), updateableFields), updatedUser);

		// if caller is not root..
		if (!_.contains(callerRoles, 'root')) {

			logger.info('[api|user:update] Checking for privilege escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(req.user._id) && (_.contains(currentUserRoles, 'root') || _.contains(currentUserRoles, 'admin'))) {

				// log
				LogUser.failure(req, user, 'update_user', diff, req.user, 'User is not allowed to update administrators or root users.');

				// fail
				return api.fail(res, error('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
					.display('You are not allowed to update administrators or root users.')
					.log('update'),
				403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (_.contains(addedRoles, 'root') || _.contains(addedRoles, 'admin') || _.contains(removedRoles, 'root') || _.contains(removedRoles, 'admin')) {

				// log
				LogUser.failure(req, user, 'update_user', diff, req.user, 'User is not allowed change the admin or root role for anyone.');

				// fail
				return api.fail(res, error('PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '))
					.display('You are not allowed change the admin or root role for anyone.')
					.log('update'),
				403);
			}
		}

		// 3. copy over new values
		_.each(updateableFields, function(field) {
			user[field] = updatedUser[field];
		});

		// 4. validate
		user.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}
			logger.info('[api|user:update] Validations passed, updating user.');

			// 5. save
			user.save(assert(function() {

				LogUser.successDiff(req, updatedUser, 'update', _.pick(user.obj(), updateableFields), updatedUser, req.user);
				logger.info('[api|user:update] Success!');

				// 6. update ACLs if roles changed
				if (removedRoles.length > 0) {
					logger.info('[api|user:update] Updating ACLs: Removing roles [%s] from user <%s>.', removedRoles.join(' '), user.email);
					acl.removeUserRoles(user.id, removedRoles);
				}
				if (addedRoles.length > 0) {
					logger.info('[api|user:update] Updating ACLs: Adding roles [%s] to user <%s>.', addedRoles.join(' '), user.email);
					acl.addUserRoles(user.id, addedRoles);
				}

				// 7. if changer is not changed user, mark user as dirty
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
			}, 'Error updating user "%s"'));
		});
	}, 'Error finding user "%s"'));
};


/**
 * Returns user details for a given ID
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	var assert = api.assert(error, 'view', req.params.id, res);

	User.findOne({ id: req.params.id }, assert(function(user) {
		if (!user) {
			return api.fail(res, error('No such user'), 404);
		}

		acl.isAllowed(req.user.id, 'users', 'full-details', assert(function(fullDetails) {

			return api.success(res, fullDetails ? user.toDetailed() : user.toReduced());

		}, 'Error checking for ACL "users/full-details"'));

	}, 'Error finding user "%s"'));
};


/**
 * Deletes an existing user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.del = function(req, res) {

	var assert = api.assert(error, 'delete', req.params.id, res);

	User.findOne({ id: req.params.id }, assert(function(user) {
		if (!user) {
			return api.fail(res, error('No such user'), 404);
		}
		user.remove(assert(function() {
			acl.removeUserRoles(user.id, user.roles);
			logger.info('[api|user:delete] User <%s> successfully deleted.', user.email);
			res.status(204).end();

		}, 'Error deleting user "%s"'));

	}, 'Error finding user "%s"'));
};
