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
const passport = require('passport');
const randomstring = require('randomstring');

const User = require('mongoose').model('User');
const Token = require('mongoose').model('Token');
const LogUser = require('mongoose').model('LogUser');

const acl = require('../../acl');
const api = require('./api');
const auth = require('../auth');
const scope = require('../../scope');

const quota = require('../../modules/quota');
const pusher = require('../../modules/pusher');
const mailer = require('../../modules/mailer');
const error = require('../../modules/error')('api', 'user');
const config = require('../../modules/settings').current;

const UserSerializer = require('../../serializers/user.serializer');

// redis
const Redis = require('redis');
Promise.promisifyAll(Redis.RedisClient.prototype);
Promise.promisifyAll(Redis.Multi.prototype);
const redis = Redis.createClient(config.vpdb.redis.port, config.vpdb.redis.host, { no_ready_check: true });
redis.select(config.vpdb.redis.db);
redis.on('error', err => logger.error(err.message));

/**
 * Returns the current user's profile.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	let acls;
	return Promise.try(() => getACLs(req.user)).then(a => {
		acls = a;
		return quota.getCurrent(req.user);

	}).then(quota => {
		return api.success(res, _.extend(UserSerializer.detailed(req.user, req), acls, { quota: quota }), 200);

	}).catch(api.handleError(res, error, 'Error retrieving user'));
};


/**
 * Updates the current user's profile.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.update = function(req, res) {

	const updateableFields = [ 'name', 'location', 'email', 'preferences', 'channel_config' ];

	// api test behavior
	let testMode = process.env.NODE_ENV === 'test';
	let currentUser = req.user;
	let errors = {};
	let user, updatedUser;

	return Promise.try(() => {
		return User.findById(currentUser._id).exec();

	}).then(u => {
		updatedUser = u;

		if (!updatedUser) {
			throw error('User not found. Seems be deleted since last login.').status(404);
		}

		if (req.body.name) {
			return User.findOne({ name: req.body.name, id: { $ne: currentUser.id }}).exec();
		}
		return null;

	}).then(dupeNameUser => {

		if (dupeNameUser) {
			throw error('Validation failed').validationError('name', 'User with this display name already exists', req.body.name);
		}

		_.extend(updatedUser, _.pick(req.body, updateableFields));

		// CHANGE PASSWORD
		if (req.body.password && !req.body.username) {

			// check for current password
			if (!req.body.current_password) {
				errors.current_password = {
					message: 'You must provide your current password.',
					path: 'current_password'
				};

			} else {
				// change password
				if (updatedUser.authenticate(req.body.current_password)) {
					updatedUser.password = req.body.password;
					LogUser.success(req, updatedUser, 'change_password');
				} else {
					errors.current_password = { message: 'Invalid password.', path: 'current_password' };
					logger.warn('[api|user:update] User <%s> provided wrong current password while changing.', currentUser.email);
				}
			}
		}

		// CREATE LOCAL ACCOUNT
		if (req.body.username && currentUser.provider !== 'local') {

			if (!req.body.password) {
				errors.password = { message: 'You must provide your new password.', path: 'password' };

			} else {
				updatedUser.password = req.body.password;
				updatedUser.username = req.body.username;
				updatedUser.provider = 'local';
				LogUser.success(req, updatedUser, 'create_local_account', { username: req.body.username });
			}
		}
		if (req.body.username && currentUser.provider === 'local' && req.body.username !== updatedUser.username) {
			errors.username = { message: 'Cannot change username for already local account.', path: 'username' };
		}

		// CHANNEL CONFIG
		if (req.body.channel_config && !pusher.isUserEnabled(updatedUser)) {
			errors.channel_config = {
				message: 'Realtime features are not enabled for this account.',
				path: 'channel_config'
			};
		}

		// validate
		return updatedUser.validate().catch(validationErr => validationErr);

	}).then(validationErr => {

		// merge errors
		if (validationErr || _.keys(errors).length) {
			let errs = _.extend(errors, validationErr ? validationErr.errors : {});
			throw error('Validation failed:').errors(errs).warn('update').status(422);
		}

		// EMAIL CHANGE
		if (currentUser.email !== updatedUser.email) {

			// there ALREADY IS a pending request.
			if (currentUser.email_status && currentUser.email_status.code === 'pending_update') {

				// just ignore if it's a re-post of the same address (double patch for the same new email doesn't re-trigger the confirmation mail)
				if (currentUser.email_status.value === updatedUser.email) {
					updatedUser.email = currentUser.email;

				// otherwise fail
				} else {
					throw error().errors([{ message: 'You cannot update an email address that is still pending confirmation. If your previous change was false, reset the email first by providing the original value.', path: 'email' }]).status(422);
				}

			} else {
				// check if we've already validated this address
				if (_.includes(currentUser.validated_emails, updatedUser.email)) {
					updatedUser.email_status = { code: 'confirmed' };

				} else {
					updatedUser.email_status = {
						code: 'pending_update',
						token: randomstring.generate(16),
						expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
						value: updatedUser.email
					};
					updatedUser.email = currentUser.email;
					LogUser.success(req, updatedUser, 'update_email_request', { 'old': { email: currentUser.email }, 'new': { email: updatedUser.email_status.value }});
					mailer.emailUpdateConfirmation(updatedUser);
				}
			}

		} else if (req.body.email) {
			// in here it's a special case:
			// the email has been posted but it's the same as the current
			// email. this situation is meant for aborting a pending
			// confirmation request and set the email back to what it was.

			// so IF we really are pending, simply set back the status to "confirmed".
			if (currentUser.email_status && currentUser.email_status.code === 'pending_update') {
				logger.warn('[api|user:update] Canceling email confirmation with token "%s" for user <%s> -> <%s> (%s).', currentUser.email_status.token, currentUser.email, currentUser.email_status.value, currentUser.id);
				LogUser.success(req, updatedUser, 'cancel_email_update', { email: currentUser.email, email_canceled: currentUser.email_status.value });
				updatedUser.email_status = { code: 'confirmed' };
			}
		}

		return updatedUser.save();

	}).then(u => {
		user = u;
		LogUser.successDiff(req, updatedUser, 'update', _.pick(currentUser.toObject(), updateableFields), updatedUser);

		// log
		if (req.body.password) {
			if (req.body.username) {
				logger.info('[api|user:update] Successfully added local credentials with username "%s" to user <%s> (%s).', user.username, user.email, user.id);
			} else {
				logger.info('[api|user:update] Successfully changed password of user "%s".', user.username);
			}
		}
		req.user = user;

		// if all good, enrich with ACLs
		return getACLs(user);

	}).then(acls => {

		// return result now and send email afterwards
		if (testMode && req.body.returnEmailToken) {
			return api.success(res, _.extend(UserSerializer.detailed(user, req), acls, { email_token: user.email_status.toObject().token }), 200);
		}

		return api.success(res, _.extend(UserSerializer.detailed(user, req), acls), 200);

	}).catch(api.handleError(res, error, 'Error updating user'));
};


/**
 * Authenticates a set of given credentials.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.authenticate = function(req, res) {

	const ipAddress = req.ip || (req.headers ? req.headers['x-forwarded-for'] : null) || (req.connection ? req.connection.remoteAddress : null) || '0.0.0.0';
	const backoffNumDelay = config.vpdb.loginBackoff.keep;
	const backoffDelay = config.vpdb.loginBackoff.delay;
	const backoffNumKey = 'auth_delay_num:' + ipAddress;
	const backoffDelayKey = 'auth_delay_time:' + ipAddress;

	let user, how;
	let antiBruteForce = false;
	return Promise.try(() => {
		// check if there's a delay
		return redis.ttlAsync(backoffDelayKey);

	}).then(ttl => {
		if (ttl > 0) {
			throw error('Too many failed login attempts from %s, blocking for another %s seconds.', ipAddress, ttl)
				.display('Too many failed login attempts from this IP, try again in %s seconds.', ttl)
				.body({ wait: ttl })
				.warn('authenticate')
				.status(429);
		}

		// try to authenticate with user/pass
		if (!req.body.username || !req.body.password) {
			return null;
		}
		antiBruteForce = true;
		return User.findOne({ username: req.body.username }).exec().then(usr => {
			if (!usr || !usr.authenticate(req.body.password)) {
				if (usr) {
					LogUser.failure(req, usr, 'authenticate', { provider: 'local' }, null, 'Invalid password.');
				}
				throw error('Authentication denied for user "%s" (%s)', req.body.username, usr ? 'password' : 'username')
					.display('Wrong username or password')
					.warn('authenticate')
					.status(401);
			}
			user = usr;
			how = 'password';
		});

	}).then(() => {

		// check if already authenticated by user/pass
		if (user) {
			return;
		}

		// if no token provided, fail fast.
		if (!req.body.token) {
			throw error('Ignored incomplete authentication request')
				.display('You must supply a username and password or a token with "login" scope.')
				.warn('authenticate')
				.status(400);
		}

		// fail if token has incorrect syntax
		if (!/[0-9a-f]{32,}/i.test(req.body.token)) {
			throw error('Ignoring auth with invalid token %s', req.body.token)
				.display('Incorrect login token.')
				.warn('authenticate')
				.status(400);
		}

		return Token.findOne({ token: req.body.token }).populate('_created_by').exec().then(token => {

			// fail if not found
			if (!token) {
				antiBruteForce = true;
				throw error('Invalid token.').status(401);
			}

			// fail if invalid type
			if (token.type !== 'personal') {
				throw error('Cannot use token of type "%s" for authentication (must be of type "personal").', token.type).status(401);
			}

			// fail if not login token
			if (!scope.isIdentical(token.scopes, [ 'login' ])) {
				throw error('Token to exchange for JWT must exclusively be "login" ([ "' + token.scopes.join('", "') + '" ] given).').status(401);
			}

			// fail if token expired
			if (token.expires_at.getTime() < new Date().getTime()) {
				throw error('Token has expired.').status(401);
			}

			// fail if token inactive
			if (!token.is_active) {
				throw error('Token is inactive.').status(401);
			}

			user = token._created_by;
			how = 'token';

			return token.update({ last_used_at: new Date() });
		});

	}).then(() => {

		// fail if user inactive
		if (!user.is_active) {
			if (user.email_status && user.email_status.code === 'pending_registration') {
				LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account due to pending email confirmation.');
				throw error('User <%s> tried to login with unconfirmed email address.', user.email)
					.display('Your account is inactive until you confirm your email address <%s>. If you did not get an email from <%s>, please contact an administrator.', user.email, config.vpdb.email.sender.email)
					.warn('authenticate')
					.status(403);

			} else {
				LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account.');
				throw error('User <%s> is disabled, refusing access', user.email)
					.display('Inactive account. Please contact an administrator')
					.warn('authenticate')
					.status(403);
			}
		}

		// generate token and return.
		const now = new Date();
		const expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
		const token = auth.generateApiToken(user, now, how !== 'password');

		LogUser.success(req, user, 'authenticate', { provider: 'local', how: how });
		logger.info('[api|user:authenticate] User <%s> successfully authenticated using %s.', user.email, how);
		return getACLs(user).then(acls => {
			return {
				token: token,
				expires: expires,
				user: _.extend(UserSerializer.detailed(user, req), acls)
			};
		});

	}).then(result => {
		return api.success(res, result, 200);

	}).catch(err => {
		if (antiBruteForce) {
			let num;
			return redis.incrAsync(backoffNumKey).then(n => {
				num = n;
				let wait = backoffDelay[Math.min(num, backoffDelay.length) - 1];
				logger.info('[api|user:authenticate] Increasing back-off time to %s for try number %d.', wait, num);
				if (wait > 0) {
					return redis.setAsync(backoffDelayKey, true).then(() => redis.expireAsync(backoffDelayKey, wait));
				}
			}).then(() => {
				if (num === 1) {
					return redis.expireAsync(backoffNumKey, backoffNumDelay);
				}
			}).then(() => {
				throw err;
			});
		} else {
			throw err;
		}
	}).catch(api.handleError(res, error, 'Error authenticating user'));
};


/**
 * Confirms user's email for a given token.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.confirm = function(req, res) {

	let user, currentCode, logEvent, successMsg, failMsg = 'No such token or token expired.';
	return Promise.try(() => {
		return User.findOne({ 'email_status.token': req.params.tkn }).exec();

	}).then(u => {
		user = u;

		if (!user) {
			throw error('No user found with email token "%s".', req.params.tkn)
				.display(failMsg)
				.warn('confirm')
				.status(404);
		}
		if (user.email_status.expires_at.getTime() < new Date().getTime()) {
			throw error('Email token "%s" for user <%s> is expired (%s).', req.params.tkn, user.email, user.email_status.expires_at)
				.display(failMsg)
				.warn('confirm')
				.status(404);
		}

		// now we have a valid user that is either pending registration or update.
		// BUT meanwhile there might have been an oauth account creation with the same email,
		// or even another unconfirmed local account. so check if we need to merge or delete.
		return User.find({
			$or: [
				{ email: user.email },
				{ emails: user.email },
				{ validated_emails: user.email }
			],
			id: { $ne: user.id }
		}).exec().then(otherUsers => {
			const deleteUsers = [];
			const mergeUsers = [];

			otherUsers.forEach(otherUser => {
				// other "pending_registration" accounts are deleted, they don't have anything merge-worthy, and we already have local credentials.
				if (otherUser.email_status && otherUser.email_status.code === 'pending_registration') {
					deleteUsers.push(otherUser);
				}
				// other "pending_update" accounts are ignored and will be treated when confirmed
				if (otherUser.email_status && otherUser.email_status.code === 'pending_update') {
					return;
				}
				// the rest needs merging
				mergeUsers.push(otherUser);
			});
			logger.log('[api|user:confirm] Found %s confirmed and %s unconfirmed dupe users for %s.', mergeUsers.length, deleteUsers.length, user.email);

			return Promise.all(deleteUsers.map(u => u.remove())).then(() => {

				// no dupes, let's continue.
				if (mergeUsers.length === 0) {
					return user;
				}

				// auto-merge if only one user without credentials
				if (mergeUsers.length === 1 && mergeUsers[0].provider !== 'local') {
					return User.mergeUsers(user, mergeUsers[0], null, req);
				}

				// otherwise we need to manually merge.
				const explanation = `During the email validation, another account with the same email was created and validated. If that wasn't you, you should be worried an contact us immediately!`;
				return User.tryMergeUsers([ user, ...mergeUsers ], explanation, req, error);
			});
		});

	}).then(u => {

		user = u;
		currentCode = user.email_status.code;
		if (currentCode === 'pending_registration') {
			user.is_active = true;
			logger.log('[api|user:confirm] User email <%s> for pending registration confirmed.', user.email);
			successMsg = 'Email successfully validated. You may login now.';
			logEvent = 'registration_email_confirmed';

		} else if (currentCode === 'pending_update') {
			logger.log('[api|user:confirm] User email <%s> for pending update confirmed.', user.email_status.value);
			user.email = user.email_status.value;
			successMsg = 'Email validated and updated.';
			logEvent = 'email_confirmed';

		} else {
			/* istanbul ignore next  */
			throw error('Unknown email status code "%s"', user.email_status.code)
				.display('Internal server error, please contact an administrator.')
				.log();
		}

	}).then(() => {
		user.email_status = { code: 'confirmed' };
		user.validated_emails = user.validated_emails || [];
		user.validated_emails.push(user.email);
		user.validated_emails = _.uniq(user.validated_emails);

		return user.save();

	}).then(() => {

		api.success(res, { message: successMsg, previous_code: currentCode });
		LogUser.success(req, user, logEvent, { email: user.email });

		if (logEvent === 'registration_email_confirmed' && config.vpdb.email.confirmUserEmail) {
			mailer.welcomeLocal(user);
		}

		return null;

	}).catch(api.handleError(res, error, 'Error confirming user email'));
};


/**
 * Authentication route for third party strategies.
 *
 * Note that this is passed as-is to passport, so the URL params should be the
 * same as the ones from the third party provider.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {function} next
 */
exports.authenticateOAuth2 = function(req, res, next) {

	// use passport with a custom callback: http://passportjs.org/guide/authenticate/
	passport.authenticate(req.params.strategy, passportCallback(req, res))(req, res, next);
};


/**
 * Skips passport authentication and processes the user profile directly.
 * @returns {Function}
 */
exports.authenticateOAuth2Mock = function(req, res) {
	logger.log('[api|user:auth-mock] Processing mock authentication via %s...', req.body.provider);
	const profile = req.body.profile;
	if (profile) {
		profile._json = {
			info: 'This mock data and is more complete otherwise.',
			id: req.body.profile ? req.body.profile.id : null
		};
	}
	require('../../passport').verifyCallbackOAuth(req.body.provider, req.body.providerName)(req, null, null, profile, passportCallback(req, res));
};


/**
 * Returns a custom callback function for passport. It basically checks if the
 * user object was populated, enriches it and returns it or fails.
 *
 * @param {Request} req
 * @param {Response} res
 * @returns {Function}
 */
function passportCallback(req, res) {
	return function(err, user, info) {
		if (err) {
			if (err.oauthError) {
				return api.fail(res, error(err, 'Authentication failed: %j', err.oauthError).warn('authenticate', req.params.strategy), err.code || 401);
			} else {
				return api.fail(res, err);
			}

		}
		if (!user) {
			return api.fail(res, error('No user object in passport callback. More info: %j', info)
				.display(info ? info : 'Could not retrieve user.')
				.log('authenticate', req.params.strategy),
			500);
		}

		// fail if user inactive
		if (!user.is_active) {
			LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account.');
			throw error('User <%s> is disabled, refusing access', user.email)
				.display('Inactive account. Please contact an administrator')
				.warn('authenticate')
				.status(403);
		}

		// generate token and return.
		const now = new Date();
		const expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
		const token = auth.generateApiToken(user, now, false);

		logger.info('[api|%s:authenticate] User <%s> successfully authenticated.', req.params.strategy, user.email);
		getACLs(user).then(acls => {
			return api.success(res, {
				token: token,
				expires: expires,
				user: _.extend(UserSerializer.detailed(user, req), acls)
			}, 200);
		});
	};
}


/**
 * Returns the ACLs for a given user.
 *
 * @param {User} user
 * @return Promise.<{permissions: string[]}>
 */
function getACLs(user) {
	return acl.userRoles(user.id)
		.then(roles => acl.whatResources(roles))
		.then(resources => acl.allowedPermissions(user.id, _.keys(resources)))
		.then(permissions => {
			return { permissions: permissions };
		});
}