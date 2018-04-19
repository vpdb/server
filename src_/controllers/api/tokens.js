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
const jwt = require('jwt-simple');

const error = require('../../modules/error')('api', 'token');
const api = require('./api');
const acl = require('../../../src/common/acl');
const scope = require('../../../src/common/scope');
const Token = require('mongoose').model('Token');
const TokenSerializer = require('../../serializers/token.serializer');

const settings = require('../../../src/common/settings');
const config = settings.current;

exports.create = function(req, res) {

	let newToken;
	return Promise.try(() => {

		// default type is "personal".
		req.body.type = req.body.type || 'personal';

		// check if the plan allows application token creation
		if (scope.has(req.body.scopes, scope.ALL) && !req.user.planConfig.enableAppTokens) {
			throw error('Your current plan "%s" does not allow the creation of application tokens with the "all" scope. Upgrade or contact an admin.', req.user.planConfig.id).status(401);
		}

		// tokenType == "jwt" means the token comes from a "fresh" login (not a
		// refresh token) from either user/password or oauth2.
		if (req.tokenType === 'jwt') {

			// in this case, the user is allowed to create login tokens without
			// additionally supplying the password.
			if (!scope.has(req.body.scopes, scope.LOGIN) && !req.body.password) {
				throw error('You cannot create other tokens but login tokens without supplying a password, ' +
					'even when logged with a "short term" token.').warn('create-token').status(401);
			}

		} else {

			// if the token type is not "jwt" (but "jwt-refreshed" or "access-token"),
			// the user must provide a password.
			if (!req.body.password) {
				throw error('When logged with a "long term" token (either from a X-Token-Refresh header or ' +
					'from an access token), you must provide your password.').warn('create-token').status(401);
			}
		}

		// in any case, if a password is supplied, check it.
		if (req.body.password) {

			if (!req.user.passwordSet()) {
				throw error('First set a password under your profile before adding tokens.').status(400);
			}

			if (!req.user.authenticate(req.body.password)) {
				throw error('Wrong password.').warn('create-token').status(401);
			}
		}

		// for application tokens, check additional permissions.
		if (req.body.type === 'provider') {
			return acl.isAllowed(req.user.id, 'tokens', 'provider-token').then(granted => {
				if (!granted) {
					throw error('Permission denied.').status(401);
				}
				newToken = new Token(_.extend(req.body, {
					label: req.body.label,
					is_active: true,
					created_at: new Date(),
					expires_at: new Date(new Date().getTime() + 315360000000), // 10 years
					_created_by: req.user._id
				}));
				return newToken.validate();
			});
		}

		newToken = new Token(_.extend(req.body, {
			label: req.body.label || req.headers['user-agent'],
			is_active: true,
			created_at: new Date(),
			expires_at: new Date(new Date().getTime() + 31536000000), // 1 year
			_created_by: req.user._id
		}));
		return newToken.validate();

	}).then(() => {
		return newToken.save();

	}).then(() =>  {
		logger.info('[api|token:create] Token "%s" successfully created.', newToken.label);
		return api.success(res, TokenSerializer.detailed(newToken, req), 201);

	}).catch(api.handleError(res, error, 'Error creating token'));
};

exports.view = function(req, res) {

	const token = req.params.id;
	return Promise.try(() => {

		// app token?
		if (/[0-9a-f]{32,}/i.test(token)) {

			return Token.findOne({ token: token }).populate('_created_by').exec().then(appToken => {

				// fail if not found
				if (!appToken) {
					throw error('Invalid token.').status(404);
				}

				const tokenInfo = {};
				tokenInfo.label = appToken.label;
				tokenInfo.type = appToken.type;
				tokenInfo.scopes = appToken.scopes;
				tokenInfo.created_at = appToken.created_at;
				tokenInfo.expires_at = appToken.expires_at;
				tokenInfo.is_active = appToken.is_active;

				// additional props for application token
				if (appToken.type === 'provider') {
					tokenInfo.provider = appToken.provider;
				} else {
					tokenInfo.for_user = appToken._created_by.id;
				}

				return tokenInfo;
			});

		// Otherwise, assume it's a JWT.
		} else {

			// decode
			let decoded;
			try {
				decoded = jwt.decode(token, config.vpdb.secret, false, 'HS256');
			} catch (e) {
				throw error('Invalid token.').status(404);
			}
			const tokenInfo = {};
			tokenInfo.type = decoded.irt ? 'jwt-refreshed' : 'jwt';
			tokenInfo.scopes = ['all'];
			tokenInfo.expires_at = new Date(decoded.exp);
			tokenInfo.is_active = true; // JTWs cannot be revoked, so they are always active
			tokenInfo.for_user = decoded.iss;
			if (decoded.path) {
				tokenInfo.for_path = decoded.path;
			}
			return tokenInfo;
		}

	}).then(tokenInfo => {
		return api.success(res, tokenInfo, 200);

	}).catch(api.handleError(res, error, 'Error creating token'));
};

exports.list = function(req, res) {

	const query = { _created_by: req.user._id, type: 'personal' };
	const allowedTypes = [ 'personal', 'provider' ];

	// filter by type?
	if (req.query.type && _.includes(allowedTypes, req.query.type)) {
		query.type = req.query.type;
	}

	Token.find(query, function(err, tokens) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error listing tokens').log('list'), 500);
		}

		// reduce
		tokens = _.map(tokens, token => TokenSerializer.simple(token, req));
		return api.success(res, tokens);
	});
};

exports.update = function(req, res) {

	const assert = api.assert(error, 'update', req.params.id, res);
	const updatableFields = ['label', 'is_active', 'expires_at', 'scopes' ]; // TODO enable expires_at only in debug, not in prod

	Token.findOne({ id: req.params.id, _created_by: req.user._id }, assert(function(token) {
		if (!token) {
			return api.fail(res, error('No such token'), 404);
		}

		_.extend(token, _.pick(req.body, updatableFields));

		token.validate(function(err) {
			if (err) {
				console.log('1');
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('update'), 422);
			}
			token.save(assert(function() {

				logger.info('[api|token:update] Token "%s" successfully updated.', token.label);
				return api.success(res, TokenSerializer.simple(token, req), 200);

			}, 'Error updating token "%s"'));
		});
	}, 'Error finding token "%s"'));
};

exports.del = function(req, res) {

	const assert = api.assert(error, 'delete', req.params.id, res);

	Token.findOne({ id: req.params.id, _created_by: req.user._id }, assert(function(token) {
		if (!token) {
			return api.fail(res, error('No such token'), 404);
		}
		token.remove(assert(function() {
			res.status(204).end();

		}, 'Error deleting token "%s"'));

	}, 'Error finding token "%s"'));
};
