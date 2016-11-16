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
    redis.on('error', console.error.bind(console));


/**
 * Creates a new user.
 *
 * @param {Request} req Request object
 * @param {Response} res Response object
 */
exports.create = function(req, res) {

	let newUser, skipEmailConfirmation, testMode;
	Promise.try(() => {

		newUser = _.assignIn(_.pick(req.body, 'username', 'password', 'email'), {
			provider: 'local'
		});

		// api test behavior
		testMode = process.env.NODE_ENV === 'test';
		skipEmailConfirmation = testMode && req.body.skipEmailConfirmation;

		// TODO make sure newUser.email is sane (comes from user directly)
		return User.findOne({ email: newUser.email }).exec();

	}).then(user => {

		if (user) {
			throw error('User with email <%s> already exists.', newUser.email).warn('create').status(409);
		}
		let confirmUserEmail = config.vpdb.email.confirmUserEmail && !skipEmailConfirmation;
		return User.createUser(newUser, confirmUserEmail);

	}).then(user => {

		LogUser.success(req, user, 'registration', { provider: 'local', email: newUser.email, username: newUser.username });

		// return result now and send email afterwards
		if (testMode && req.body.returnEmailToken) {
			api.success(res, _.extend(user.toDetailed(), { email_token: user.email_status.token }), 201);

		} else {
			api.success(res, user.toDetailed(), 201);
		}

		// user validated and created. time to send the activation email.
		if (config.vpdb.email.confirmUserEmail) {
			mailer.registrationConfirmation(user);
		}

	}).catch(api.handleError(res, error, 'Error creating user'));
};


/**
 * Lists users.
 *
 * @param {Request} req Request object
 * @param {Response} res Response object
 */
exports.list = function(req, res) {

	let canList, canGetFullDetails;
	Promise.try(() => {
		return acl.isAllowed(req.user.id, 'users', 'list');

	}).then(result => {
		canList = result;
		return acl.isAllowed(req.user.id, 'users', 'full-details');

	}).then(result => {
		canGetFullDetails = result;

		if (!canList && (!req.query.q || req.query.q.length < 3) && !req.query.name) {
			throw error('Please provide a search query with at least three characters or a user name').status(403);
		}
		let query = [];

		// text search
		if (req.query.q) {
			// sanitize and build regex
			let q = req.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
			let regex = new RegExp(q, 'i');
			if (canList) {
				query.push({ $or: [
					{ name: regex },
					{ username: regex },
					{ email: regex }
				]});
			} else {
				query.push({ $or: [
					{ name: regex },
					{ username: regex }
				]});
			}
		}
		if (req.query.name) {
			query.push({ name: new RegExp('^' + _.escapeRegExp(req.query.name) + '$', 'i') });
		}

		// filter by role
		if (canList && req.query.roles) {
			// sanitze and split
			let roles = req.query.roles.trim().replace(/[^a-z0-9,-]+/gi, '').split(',');
			query.push( { roles: { $in: roles }});
		}
		return User.find(api.searchQuery(query)).exec();

	}).then(users => {
		// reduce
		users = users.map(user => canGetFullDetails ? user.toSimple() : user.toReduced());
		api.success(res, users);

	}).catch(api.handleError(res, error, 'Error listing users'));
};


/**
 * Updates an existing user.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.update = function(req, res) {

	// TODO move into model
	var updateableFields = [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ];
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

		var diff = LogUser.diff(_.pick(user.toObj(), updateableFields), updatedUser);

		// if caller is not root..
		if (!_.includes(callerRoles, 'root')) {

			logger.info('[api|user:update] Checking for privilege escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(req.user._id) && (_.includes(currentUserRoles, 'root') || _.includes(currentUserRoles, 'admin'))) {

				// log
				LogUser.failure(req, user, 'update', diff, req.user, 'User is not allowed to update administrators or root users.');

				// fail
				return api.fail(res, error('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
					.display('You are not allowed to update administrators or root users.')
					.log('update'),
				403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (_.includes(addedRoles, 'root') || _.includes(addedRoles, 'admin') || _.includes(removedRoles, 'root') || _.includes(removedRoles, 'admin')) {

				// log
				LogUser.failure(req, user, 'update', diff, req.user, 'User is not allowed change the admin or root role for anyone.');

				// fail
				return api.fail(res, error('PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '))
					.display('You are not allowed change the admin or root role for anyone.')
					.log('update'),
				403);
			}
		}

		// 3. copy over new values
		updateableFields.forEach(function(field) {
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

				LogUser.successDiff(req, updatedUser, 'update', _.pick(user.toObj(), updateableFields), updatedUser, req.user);
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
