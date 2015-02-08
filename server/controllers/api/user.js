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
var passport = require('passport');
var randomstring = require('randomstring');

var User = require('mongoose').model('User');
var LogUser = require('mongoose').model('LogUser');
var acl = require('../../acl');
var api = require('./api');
var auth = require('../auth');
var mailer = require('../../modules/mailer');
var error = require('../../modules/error')('api', 'user');
var config = require('../../modules/settings').current;


/**
 * Returns the current user's profile.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	getACLs(req.user, function(err, acls) {
		if (err) {
			// TODO check if it's clever to reveal anything here
			return api.fail(res, err, 500);
		}
		api.success(res, _.extend(req.user.toDetailed(), acls), 200);
	});
};


/**
 * Updates the current user's profile. For now it suports only password change, which might change in the future.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.update = function(req, res) {

	// api test behavior
	var testMode = process.env.NODE_ENV === 'test';

	var currentUser = req.user;
	var updateableFields = [ 'name', 'location', 'email', 'preferences' ];
	var assert = api.assert(error, 'update', currentUser.email, res);

	User.findById(currentUser._id, assert(function(updatedUser) {

		_.extend(updatedUser, _.pick(req.body, updateableFields));

		var errors = {};

		// CHANGE PASSWORD
		if (req.body.password && !req.body.username) {

			// check for current password
			if (!req.body.current_password) {
				errors.current_password = { message: 'You must provide your current password.', path: 'current_password' };

			} else  {
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
		if (req.body.username) {

			if (currentUser.provider === 'local') {
				errors.username = { message: 'Cannot change username for already local account.', path: 'username' };

			} else if (!req.body.password) {
				errors.password = { message: 'You must provide your new password.', path: 'password' };

			} else {
				updatedUser.password = req.body.password;
				updatedUser.username = req.body.username;
				updatedUser.provider = 'local';
				LogUser.success(req, updatedUser, 'create_local_account', { username: req.body.username });
			}
		}

		updatedUser.validate(function(validationErr) {

			if (validationErr || _.keys(errors).length) {
				var errs = _.extend(errors, validationErr ? validationErr.errors : {});
				return api.fail(res, error('Validation failed:').errors(errs).warn('update'), 422);
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
						return api.fail(res, error().errors([{ message: 'You cannot update an email address that is still pending confirmation. If your previous change was false, reset the email first by providing the original value.', path: 'email' }]), 422);
					}

				} else {
					// check if we've already validated this address
					if (_.contains(currentUser.validated_emails, updatedUser.email)) {
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

			// save
			updatedUser.save(assert(function(user) {

				LogUser.successDiff(req, updatedUser, 'update', _.pick(currentUser.obj(), updateableFields), updatedUser);

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
				getACLs(user, assert(function(acls) {

					// return result now and send email afterwards
					if (testMode && req.body.returnEmailToken) {
						api.success(res, _.extend(user.toDetailed(), acls, { email_token: user.email_status.token }), 200);
					} else {
						api.success(res, _.extend(user.toDetailed(), acls), 200);
					}

				}, 'Error retrieving ACLs for user <%s>.'));
			}, 'Error saving user <%s>.'));
		});

	}, 'Error fetching current user <%s>.'));
};


/**
 * Authenticates a set of given credentials.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.authenticate = function(req, res) {

	if (!req.body.username || !req.body.password) {
		return api.fail(res, error('Ignored incomplete authentication request')
				.display('You must supply a username and password')
				.warn('authenticate'),
			400);
	}
	var assert = api.assert(error, 'authenticate', req.body.username, res);
	User.findOne({ username: req.body.username }, assert(function(user) {

		if (!user || !user.authenticate(req.body.password)) {
			if (user) {
				LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Invalid password.');
			}

			return api.fail(res, error('Authentication denied for user "%s" (%s)', req.body.username, user ? 'password' : 'username')
					.display('Wrong username or password')
					.warn('authenticate'),
				401);
		}
		if (!user.is_active) {
			if (user.email_status && user.email_status.code === 'pending_registration') {
				LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account due to pending email confirmation.');
				return api.fail(res, error('User <%s> tried to login with unconfirmed email address.', user.email)
						.display('Your account is inactive until you confirm your email address <%s>. If you did not get an email from <%s>, please contact an administrator.', user.email, config.vpdb.email.sender.email)
						.warn('authenticate'),
					401);

			} else {
				LogUser.failure(req, user, 'authenticate', { provider: 'local' }, null, 'Inactive account.');
				return api.fail(res, error('User <%s> is disabled, refusing access', user.email)
						.display('Inactive account. Please contact an administrator')
						.warn('authenticate'),
					401);
			}
		}

		var now = new Date();
		var expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
		var token = auth.generateApiToken(user, now);

		LogUser.success(req, user, 'authenticate', { provider: 'local' });
		logger.info('[api|user:authenticate] User <%s> successfully authenticated.', user.email);
		getACLs(user, assert(function(acls) {
			// all good!
			api.success(res, {
				token: token,
				expires: expires,
				user: _.extend(user.toSimple(), acls)
			}, 200);
		}, 'Error retrieving ACLs for user "%s"'));

	}, 'Error while searching for "%s"'));// TODO check error message. We might not want to reveal too much here.
};


/**
 * Confirms user's email for a given token.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.confirm = function(req, res) {

	var assert = api.assert(error, 'confirm', req.params.tkn, res);
	User.findOne({ 'email_status.token': req.params.tkn }, assert(function(user) {

		var logEvent, successMsg, failMsg = 'No such token or token expired.';
		if (!user) {
			return api.fail(res, error('No user found with email token "%s".', req.params.tkn)
				.display(failMsg)
				.warn('confirm'),
			404);
		}
		if (user.email_status.expires_at.getTime() < new Date().getTime()) {
			return api.fail(res, error('Email token "%s" for user <%s> is expired (%s).', req.params.tkn, user.email, user.email_status.expires_at)
				.display(failMsg)
				.warn('confirm'),
			404);
		}

		var currentCode = user.email_status.code;
		assert = api.assert(error, 'confirm', user.email, res);

		if (currentCode === 'pending_registration') {
			user.is_active = true;
			logger.log('[api|user:confirm] User email <%s> for pending registration confirmed.', user.email);
			successMsg = 'Email successully validated. You may login now.';
			logEvent = 'registration_email_confirmed';

		} else if (currentCode === 'pending_update') {
			logger.log('[api|user:confirm] User email <%s> for pending update confirmed.', user.email_status.value);
			user.email = user.email_status.value;
			successMsg = 'Email validated and updated.';
			logEvent = 'email_confirmed';

		} else {
			/* istanbul ignore next  */
			return api.fail(res, error('Unknown email status code "%s"', user.email_status.code)
				.display('Internal server error, please contact an administrator.')
				.log(),
			500);
		}
		user.email_status = { code: 'confirmed' };
		user.validated_emails = user.validated_emails || [];
		user.validated_emails.push(user.email);
		user.validated_emails = _.uniq(user.validated_emails);

		user.save(assert(function() {
			api.success(res, { message: successMsg, previous_code: currentCode });
			LogUser.success(req, user, logEvent, { email: user.email });

		}, 'Error saving user <%s>.'));
	}, 'Error retrieving user with email token "%s".'));

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
	var profile = req.body.profile;
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
			return api.fail(res, error(err, 'Authentication failed: %j', err.oauthError)
					.warn('authenticate', req.params.strategy),
				401);
		}
		if (!user) {
			return api.fail(res, error('No user object in passport callback. More info: %j', info)
					.display(info ? info : 'Could not retrieve user.')
					.log('authenticate', req.params.strategy),
				500);
		}

		var now = new Date();
		var expires = new Date(now.getTime() + config.vpdb.apiTokenLifetime);
		var token = auth.generateApiToken(user, now);

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
	};
}


/**
 * Returns the ACLs for a given user.
 *
 * @param {User} user
 * @param {function} done done(Error, object}
 */
function getACLs(user, done) {

	acl.userRoles(user.id, function(err, roles) {
		/* istanbul ignore if  */
		if (err) {
			return done(error(err, 'Error reading ACL roles for user <%s>', user.id).log('profile'));
		}
		acl.whatResources(roles, function(err, resources) {
			/* istanbul ignore if  */
			if (err) {
				return done(error(err, 'Error ACL reading resources').log('profile'));
			}
			acl.allowedPermissions(user.id, _.keys(resources), function(err, permissions) {
				/* istanbul ignore if  */
				if (err) {
					return done(error(err, 'Error reading ACL permissions for user <%s>', user.id).log('profile'));
				}
				return done(null, { permissions: permissions });
			});
		});
	});
}