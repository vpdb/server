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
var error = require('../../modules/error')('api', 'user');
var config = require('../../modules/settings').current;

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
		var expires = new Date(now.getTime() + config.vpdb.tokenLifetime);
		var token = auth.generateToken(user, now);

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
 * Authentication route for third party strategies.
 *
 * Note that this is passed as-is to passport, so the URL params should be the
 * same as the ones from the third party provider.
 *
 * @api /api/authenticate/:strategy
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
	require('../../passport').verifyCallbackOAuth(req.body.provider, req.body.providerName)(null, null, profile, passportCallback(req, res));
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
		var expires = new Date(now.getTime() + config.vpdb.tokenLifetime);
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
	};
}

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

	var updateableFields = [ 'password' ];
	var assert = api.assert(error, 'update', req.user.email, res);

	// check for current password
	if (!req.body.currentPassword) {
		return api.fail(res, error().errors([{ message: 'You must provide your current password.', path: 'currentPassword' }]), 401);
	}

	// validate current password
	if (!req.user.authenticate(req.body.currentPassword)) {
		return api.fail(res, error('User <%s> provided wrong current password while changing.', req.user.email)
			.warn('update')
			.errors([{ message: 'Invalid password.', path: 'currentPassword' }]),
		401);
	}

	var user = _.extend(req.user, _.pick(req.body, updateableFields));
	user.validate(function(validationErr) {
		if (validationErr) {
			return api.fail(res, error('Validation failed:').errors(validationErr.errors).warn('update'), 422);
		}
		// save
		user.save(assert(function(user) {

			// if all good, enrich with ACLs
			getACLs(req.user, assert(function(acls) {
				api.success(res, _.extend(user.toDetailed(), acls), 200);
			}));
		}));
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