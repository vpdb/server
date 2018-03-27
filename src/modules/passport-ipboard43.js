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
 * IPS using the OAuth 2.0 protocol.
 *
 * You'll need at least the `profile` and `email` scope enabled when creating
 * the OAuth client.
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
	options = options || {};

	options.authorizationURL = options.baseURL + '/oauth/authorize/';
	options.tokenURL = options.baseURL + '/oauth/token/';
	options.customHeaders = options.customHeaders || {};

	if (!options.customHeaders['User-Agent']) {
		options.customHeaders['User-Agent'] = options.userAgent || 'passport-ipboard';
	}

	OAuth2Strategy.call(this, options, verify);
	this.name = options.name || 'IPS 4.3';
	this._userProfileURL = options.baseURL + '/api/core/me';
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
 * The raw profile received from /api/core/me looks like that:
 *
 *  {
 *   "id": 2,
 *   "name": "member",
 *   "title": null,
 *   "formattedName": "member",
 *   "primaryGroup": {
 *       "id": 3,
 *       "name": "Members",
 *       "formattedName": "Members"
 *   },
 *   "joined": "2018-03-28T08:43:34Z",
 *   "reputationPoints": 0,
 *   "photoUrl": "https:\/\/ips.neh.ch\/uploads\/monthly_2018_03\/M_member_2.png",
 *   "photoUrlIsDefault": true,
 *   "coverPhotoUrl": "",
 *   "profileUrl": "https:\/\/ips.neh.ch\/profile\/2-member\/",
 *   "posts": 0,
 *   "lastActivity": "2018-03-28T09:45:41Z",
 *   "lastVisit": "2018-03-28T09:45:41Z",
 *   "lastPost": null,
 *   "profileViews": 0,
 *   "birthday": null,
 *   "customFields": {
 *       "1": {
 *           "name": "Personal Information",
 *           "fields": {
 *               "1": {
 *                   "name": "About Me",
 *                   "value": null
 *               }
 *           }
 *       }
 *   },
 *   "email": "member@vpdb.io"
 * }
 *
 * @param {String} accessToken
 * @param {Function} done
 * @api protected
 */
Strategy.prototype.userProfile = function(accessToken, done) {

	logger.info('[passport-ipboard43] Getting profile for user at %s', this._userProfileURL);
	/* istanbul ignore next */
	this._oauth2.get(this._userProfileURL, accessToken, (err, body) => {
		if (err) {
			return done(new InternalOAuthError('failed to fetch user profile', err));
		}
		try {
			const json =  JSON.parse(body);
			const profile = {
				provider: this.name,
				id: json.id || json.email,
				username: json.name,
				displayName: json.formattedName,
				profileUrl: json.profileUrl,
				emails: [{ value: json.email }],
				_raw: body,
				_json: json
			};
			if (json.photoUrl) {
				profile.photos = [{ value: json.photoUrl }];
			}
			done(null, profile);
		} catch (e) {
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
