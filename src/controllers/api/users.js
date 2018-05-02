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

'use strict';

const _ = require('lodash');
const logger = require('winston');
const randomString = require('randomstring');
const validator = require('validator');

const User = require('mongoose').model('User');
const LogUser = require('mongoose').model('LogUser');

const acl = require('../../acl');
const api = require('./api');
const error = require('../../modules/error')('api', 'users');
const mailer = require('../../modules/mailer');
const config = require('../../modules/settings').current;
const removeDiacritics = require('../../passport').removeDiacritics;
const redis = require('redis').createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
redis.select(config.vpdb.redis.db);
redis.on('error', err => logger.error(err.message));

const UserSerializer = require('../../serializers/user.serializer');

/**
 * Creates a new user.
 *
 * @param {Request} req Request object
 * @param {Response} res Response object
 */
exports.create = function(req, res) {

	let newUser, skipEmailConfirmation, testMode;
	return Promise.try(() => {

		newUser = _.assignIn(_.pick(req.body, 'username', 'password', 'email'), {
			is_local: true,
			name: req.body.name || req.body.username
		});

		// api test behavior
		testMode = process.env.NODE_ENV === 'test';
		skipEmailConfirmation = testMode && req.body.skipEmailConfirmation;

		// TODO make sure newUser.email is sane (comes from user directly)
		return User.findOne({ $or: [
			{ emails: newUser.email },
			{ validated_emails: newUser.email }
		] }).exec();

	}).then(user => {

		if (user) {
			throw error('User with email <%s> already exists.', newUser.email).warn('create').status(409);
		}
		let confirmUserEmail = config.vpdb.email.confirmUserEmail && !skipEmailConfirmation;
		return User.createUser(newUser, confirmUserEmail);

	}).then(user => {

		if (config.vpdb.services.sqreen.enabled) {
			require('sqreen').signup_track({ email: user.email });
		}

		LogUser.success(req, user, 'registration', { provider: 'local', email: newUser.email, username: newUser.username });

		// return result now and send email afterwards
		if (testMode && req.body.returnEmailToken) {
			api.success(res, _.extend(UserSerializer.detailed(user, req), { email_token: user.email_status.toObject().token }), 201);

		} else {
			api.success(res, UserSerializer.detailed(user, req), 201);
		}

		// user validated and created. time to send the activation email.
		if (config.vpdb.email.confirmUserEmail) {
			mailer.registrationConfirmation(user);
		}

		return null;

	}).catch(api.handleError(res, error, 'Error creating user'));
};

exports.createOrUpdate = function(req, res) {

	let name, provider, isNew;
	return Promise.try(() => {

		// make sure there's a provider token
		if (!req.appToken || req.tokenType !== 'provider') {
			throw error('Resource only available with provider token.').status(400);
		}
		provider = req.appToken.provider;

		// validations
		let err = null;
		if (!req.body.provider_id) {
			err = (err || error('Validations failed.')).validationError('provider_id', 'Identifier at provider is required.');
		} else if (!_.isString(req.body.provider_id) && !_.isNumber(req.body.provider_id)) {
			err = (err || error('Validations failed.')).validationError('provider_id', 'Identifier at provider must be a number or a string.');
		}
		if (!req.body.email || !_.isString(req.body.email)) {
			err = (err || error('Validations failed.')).validationError('email', 'Email is required.');

		} else if (!validator.isEmail(req.body.email)) {
			err = (err || error('Validations failed.')).validationError('email', 'Email is invalid.');
		}
		if (!req.body.username) {
			err = (err || error('Validations failed.')).validationError('username', 'Username is required.');
		} else if (!_.isString(req.body.username)) {
			err = (err || error('Validations failed.')).validationError('username', 'Username must be a string.');
		} else if (!/^[0-9a-z ]{3,}$/i.test(removeDiacritics(req.body.username).replace(/[^0-9a-z ]+/gi, ''))) {
			err = (err || error('Validations failed.')).validationError('username', 'Username must be alphanumeric with at least three characters.');
		}
		if (req.body.provider_profile && !_.isObject(req.body.provider_profile)) {
			err = (err || error('Validations failed.')).validationError('provider_profile', 'Must be an object.');
		}
		if (err) {
			throw err;
		}
		name = removeDiacritics(req.body.username).replace(/[^0-9a-z ]+/gi, '');

		// create query condition
		const query = {
			$or: [
				{ ['providers.' + provider + '.id']: req.body.provider_id },
				{ email: req.body.email },
				{ validated_emails: req.body.email }
			]
		};
		return User.findOne(query).exec();

	}).then(existingUser => {

		if (existingUser) {
			if (!existingUser.providers || !existingUser.providers[provider]) {
				existingUser.providers = existingUser.providers || {};
				existingUser.providers[provider] = {
					id: String(req.body.provider_id),
					name: req.body.username || (req.body.email ? req.body.email.substr(0, req.body.email.indexOf('@')) : undefined),
					emails: [ req.body.email ],
					created_at: new Date(),
					modified_at: new Date(),
					profile: req.body.provider_profile
				};
				LogUser.success(req, existingUser, 'provider_add', { provider: provider, profile: req.body.provider_profile });
			} else {
				existingUser.providers[provider].modified_at = new Date();
				LogUser.success(req, existingUser, 'provider_update', { provider: provider });
			}
			existingUser.emails = _.uniq([existingUser.email, ...existingUser.emails, req.body.email]);
			isNew = false;

			// save and return
			return existingUser.save();
		}
		isNew = true;

		// check if username doesn't conflict
		let newUser;
		let originalName = name;
		return User.findOne({ name: name }).exec().then(dupeNameUser => {
			if (dupeNameUser) {
				name += Math.floor(Math.random() * 1000);
			}
			newUser = {
				is_local: false,
				name: name,
				email: req.body.email,
				emails: [req.body.email],
				providers: {
					[provider]: {
						id: String(req.body.provider_id),
						name: originalName,
						emails: [ req.body.email ],
						created_at: new Date(),
						profile: req.body.provider_profile
					}
				}
			};

			return User.createUser(newUser, false).then(newUser => {
				LogUser.success(req, newUser, 'provider_registration', { provider: provider, email: newUser.email });
				return newUser;
			});
		});

	}).then(user => {
		return api.success(res, UserSerializer.detailed(user, req), isNew ? 201 : 200);

	}).catch(api.handleError(res, error, 'Error creating or updating user'));
};


/**
 * Lists users.
 *
 * @param {Request} req Request object
 * @param {Response} res Response object
 */
exports.list = function(req, res) {

	let canList, canGetFullDetails;
	return Promise.try(() => {
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
		users = users.map(user => canGetFullDetails ? UserSerializer.detailed(user, req) : UserSerializer.simple(user, req));
		return api.success(res, users);

	}).catch(api.handleError(res, error, 'Error listing users'));
};


/**
 * Updates an existing user.
 *
 * @param {Request} req Request object
 * @param {Response} res Response object
 */
exports.update = async function(req, res) {

	// TODO move into model
	const updateableFields = ['name', 'email', 'username', 'is_active', 'roles', '_plan'];

	try {

		const user = await User.findOne({ id: req.params.id }).exec();
		if (!user) {
			throw error('No such user.').status(404);
		}

		const updatedUser = req.body;

		// 1. check for changed read-only fields
		const readOnlyFieldErrors = api.checkReadOnlyFields(req.body, user, updateableFields);
		if (readOnlyFieldErrors) {
			throw error('User tried to update read-only fields').errors(readOnlyFieldErrors).warn('update').status(422);
		}

		// 2. check for permission escalation
		const callerRoles = req.user.roles || [];
		const currentUserRoles = user.roles || [];
		const updatedUserRoles = updatedUser.roles || [];

		const removedRoles = _.difference(currentUserRoles, updatedUserRoles);
		const addedRoles = _.difference(updatedUserRoles, currentUserRoles);

		const diff = LogUser.diff(_.pick(user.toObject(), updateableFields), updatedUser);

		// if caller is not root..
		if (!_.includes(callerRoles, 'root')) {

			logger.info('[api|user:update] Checking for privilege escalation. Added roles: [%s], Removed roles: [%s].', addedRoles.join(' '), removedRoles.join(' '));

			// if user to be updated is already root or admin, deny (unless it's the same user).
			if (!user._id.equals(req.user._id) && (_.includes(currentUserRoles, 'root') || _.includes(currentUserRoles, 'admin'))) {

				// log
				LogUser.failure(req, user, 'update', diff, req.user, 'User is not allowed to update administrators or root users.');

				// fail
				throw error('PRIVILEGE ESCALATION: Non-root user <%s> [%s] tried to update user <%s> [%s].',
					req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '))
						.display('You are not allowed to update administrators or root users.')
						.log('update')
						.status(403);
			}

			// if new roles contain root or admin, deny (even when removing)
			if (addedRoles.includes('root') || addedRoles.includes('admin') || removedRoles.includes('root') || removedRoles.includes('admin')) {

				// log
				LogUser.failure(req, user, 'update', diff, req.user, 'User is not allowed change the admin or root role for anyone.');

				// fail
				throw error('PRIVILEGE ESCALATION: User <%s> [%s] tried to update user <%s> [%s] with new roles [%s].', req.user.email, callerRoles.join(' '), user.email, currentUserRoles.join(' '), updatedUserRoles.join(' '))
						.display('You are not allowed change the admin or root role for anyone.')
						.log('update')
						.status(403);
			}
		}

		// 3. copy over new values
		updateableFields.forEach(function(field) {
			user[field] = updatedUser[field];
		});

		// 4. validate
		await user.validate();

		// 5. save
		await user.save();

		LogUser.successDiff(req, updatedUser, 'update', _.pick(user.toObject(), updateableFields), updatedUser, req.user);
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
					return api.success(res, UserSerializer.detailed(user, req), 200);
				});
			});
		} else {
			return api.success(res, UserSerializer.detailed(user, req), 200);
		}

	} catch (err) {
		api.handleError(res, error, 'Error listing users')(err);
	}
};


/**
 * Returns user details for a given ID
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	const assert = api.assert(error, 'view', req.params.id, res);

	User.findOne({ id: req.params.id }, assert(function(user) {
		if (!user) {
			return api.fail(res, error('No such user'), 404);
		}

		acl.isAllowed(req.user.id, 'users', 'full-details', assert(function(fullDetails) {

			return api.success(res, fullDetails ? UserSerializer.detailed(user, req) : UserSerializer.simple(user, req));

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

	let user;
	return Promise.try(() => {
		return User.findOne({ id: req.params.id }).exec();

	}).then(u => {
		user = u;
		if (!user) {
			throw error('No such user').status(404);
		}
		return user.remove();

	}).then(() => {
		return acl.removeUserRoles(user.id, user.roles);

	}).then(() => {
		logger.info('[api|user:delete] User <%s> successfully deleted.', user.email);
		res.status(204).end();

	}).catch(api.handleError(res, error, 'Error deleting user'));
};


/**
 * Resets the token and expiration date and resends the confirmation mail to
 * an existing user.
 *
 * Needed if the user spelled the email wrong the first time or didn't click on
 * the link within 24 hours.
 *
 * @param {object} req Request object
 * @param {object} res Response object
 */
exports.sendConfirmationMail = function(req, res) {

	return Promise.try(() => {
		return User.findOne({ id: req.params.id }).exec();

	}).then(user => {
		if (!user) {
			throw error('No such user').status(404);
		}
		if (user.email_status.code === 'confirmed') {
			throw error('Cannot re-send confirmation mail to already confirmed address.').status(400);
		}
		user.email_status.token = randomString.generate(16);
		user.email_status.expires_at = new Date(new Date().getTime() + 86400000); // 1d valid
		return user.save();

	}).then(user => {
		return mailer.registrationConfirmation(user);

	}).then(() => {
		res.status(200).end();

	}).catch(api.handleError(res, error, 'Error sending confirmation mail to user'));
};
