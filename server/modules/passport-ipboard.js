"use strict";

var util = require('util');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var InternalOAuthError = require('passport-oauth').InternalOAuthError;
var logger = require('winston');

/**
 * `Strategy` constructor.
 *
 * The IP.Board authentication strategy authenticates requests by delegating to
 * IP.Board using the OAuth 2.0 protocol.
 *
 * Since IP.Board has no OAuth2 feature out of the box, this application needs
 * to be installed on the IP.Board in order to make it work:
 *
 * 		https://github.com/freezy/ipb-oauth2-server
 *
 * Applications must supply a `verify` callback which accepts an `accessToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `name`          An alpha-numeric string describing the name of the IP.Board you're connecting to
 *   - `baseURL`       The base URL of your IP.Board pointing to index.php, e.g. "http://yoursite.com/forums/index.php"
 *   - `clientID`      The client ID you have created using the OAuth2 Server control panel
 *   - `clientSecret`  The client secret of the OAuth2 application
 *   - `callbackURL`   URL to which IP.Board will redirect the user after granting authorization
 *   - `userAgent`     (optional) Change user agent string
 *
 * Examples:
 *
 *     passport.use(new IPBoardStrategy({
 *         name: 'myboard',
 *         baseURL: 'https://www.example.net/forums/index.php',
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/myboard/callback'
 *       },
 *       function(accessToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
	options = options || {};

	options.authorizationURL = options.baseURL + '?app=oauth2&module=server&section=authorize';
	options.tokenURL = options.baseURL + '?app=oauth2&module=server&section=token';
//	options.state = false;
	options.customHeaders = options.customHeaders || {};

	if (!options.customHeaders['User-Agent']) {
		options.customHeaders['User-Agent'] = options.userAgent || 'passport-ipboard';
	}

	OAuth2Strategy.call(this, options, verify);
	this.name = options.name || 'ipboard';
	this._userProfileURL = options.baseURL + '?app=oauth2&module=server&section=profile';
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
	var that = this;
	logger.info('[passport-ipboard] Getting profile for user at %s', this._userProfileURL);
	/* istanbul ignore next */
	this._oauth2.get(this._userProfileURL, accessToken, function (err, body, res) {
		if (err) {
			return done(new InternalOAuthError('failed to fetch user profile', err));
		}

		try {
			var json = JSON.parse(body);

			var profile = {
				provider: that.name,
				id: json.id,
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
