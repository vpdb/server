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

const util = require('util');
const OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
const InternalOAuthError = require('passport-oauth').InternalOAuthError;
const logger = require('winston');

/**
 * `Strategy` constructor.
 *
 * The IP.Board authentication strategy authenticates requests by delegating to
 * IP.Board using the OAuth 2.0 protocol.
 *
 * See https://invisionpower.com/files/file/8204-oauth-server/ for installation
 * instructions.
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
	options = options || {};

	options.authorizationURL = options.baseURL + '/applications/oauth2server/interface/oauth/authorize.php';
	options.tokenURL = options.baseURL + '/applications/oauth2server/interface/oauth/token.php';
	options.customHeaders = options.customHeaders || {};

	if (!options.customHeaders['User-Agent']) {
		options.customHeaders['User-Agent'] = options.userAgent || 'passport-ipboard';
	}

	OAuth2Strategy.call(this, options, verify);
	this.name = options.name || 'ipboard';
	this._userProfileURL = options.baseURL + '/applications/oauth2server/interface/oauth/me.php';
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(Strategy, OAuth2Strategy);


/**
 * Retrieve user profile from IP.Board.
 *
 * This function constructs a normalized profile, with the following properties:
 *
 *   - `provider`         name of the IP.Board
 *   - `id`               the user's IP.Board member ID
 *   - `username`         the user's IP.Board user name
 *   - `displayName`      the user's display name
 *   - `profileUrl`       the URL of the profile for the user on IP.Board
 *   - `emails`           the user's email addresses
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(accessToken, done) {
	const that = this;
	logger.info('[passport-ipboard] Getting profile for user at %s', this._userProfileURL);
	/* istanbul ignore next */
	this._oauth2.get(this._userProfileURL, accessToken, function (err, body) {
		if (err) {
			return done(new InternalOAuthError('failed to fetch user profile', err));
		}

		try {
			const json = JSON.parse(body);

			const profile = {
				provider: that.name,
				id: json.id || json.email,
				username: json.username,
				displayName: json.displayName,
				profileUrl: json.profileUrl,
				emails: [{ value: json.email }],
				_raw: body,
				_json: json
			};
			if (json.avatar && json.avatar.full && json.avatar.full.height) {
				profile.photos = [{ value: json.avatar.thumb.url }];
			}

			done(null, profile);
		} catch(e) {
			done(e);
		}
	});
};

/**
 * Framework version.
 */
require('pkginfo')(module, 'version');

/**
 * Expose constructors.
 */
exports.Strategy = Strategy;
