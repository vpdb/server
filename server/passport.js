"use strict";

var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');
var GitHubStrategy = require('passport-github').Strategy;
var IPBoardStrategy = require('./modules/passport-ipboard').Strategy;

var settings = require('./modules/settings');
var User = mongoose.model('User');

/**
 * Defines the authentication strategies and user serialization.
 *
 * @param config Passport configuration from settings
 * @param passport Passport module
 */
exports.configure = function(config, passport) {

	// use github strategy
	if (config.vpdb.passport.github.enabled) {
		logger.info('[passport] Enabling GitHub authentication strategy.');
		passport.use(new GitHubStrategy({
				clientID: config.vpdb.passport.github.clientID,
				clientSecret: config.vpdb.passport.github.clientSecret,
				callbackURL: settings.publicUrl(config) + '/auth/github/callback'
			}, exports.verifyCallbackOAuth('github')
		));
	}

	// ipboard strategies
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {

			var callbackUrl = settings.publicUrl(config) + '/auth/' +  ipbConfig.id + '/callback';
			logger.info('[passport|ipboard:' + ipbConfig.id + '] Enabling IP.Board authentication strategy for "%s" at %s.', ipbConfig.name, ipbConfig.baseURL);
			passport.use(new IPBoardStrategy({
					name: ipbConfig.id,
					baseURL: ipbConfig.baseURL,
					clientID: ipbConfig.clientID,
					clientSecret: ipbConfig.clientSecret,
					callbackURL: callbackUrl
				}, exports.verifyCallbackOAuth('ipboard', ipbConfig.id)
			));
		}
	});
};


/**
 * Updates or creates a new user. This is executed when we have a successful
 * authentication via one of the enabled OAuth2 strategies. It basically:
 *
 *  - checks if a user with a given ID of a given provider is already in the
 *    database
 *  - if that's the case, updates the user's profile with received data
 *  - if not but an email address matches, update the profile
 *  - otherwise create a new user.
 *
 *  Note however that if profile data is incomplete, callback will fail.
 *
 * @param strategy Name of the strategy (e.g. "GitHub", "IPBoard")
 * @param [providerName=null] For IPBoard we can have multiple configurations, (e.g. "Gameex", "VP*", ...)
 * @returns {Function} "Verify Callback" function that is passed to passport
 * @see http://passportjs.org/guide/oauth/
 */
exports.verifyCallbackOAuth = function(strategy, providerName) {
	var provider = providerName || strategy;
	var logtag = providerName ? strategy + ':' + providerName : strategy;

	return function(accessToken, refreshToken, profile, done) {

		if (!profile) {
			logger.warn('[passport|%s] No profile data received.', logtag);
			return done(null, false, { message: 'No profile received from ' + logtag + '.'});
		}
		if (!profile.emails || !profile.emails.length) {
			logger.warn('[passport|%s] Profile data does not contain any email address: %s', logtag, JSON.stringify(profile));
			return done(null, false, { message: 'Received profile from ' + logtag + ' does not contain email address.' });
		}
		if (!profile.id) {
			logger.warn('[passport|%s] Profile data does not contain any user ID: %s', logtag, JSON.stringify(profile));
			return done(null, false, { message: 'Received profile from ' + logtag + ' does not contain user id.' });
		}
		if (!profile.displayName && !profile.username) {
			logger.warn('[passport|%s] Profile data does contain neither display name nor username: %s', logtag, JSON.stringify(profile));
			return done(null, false, { message: 'Received profile from ' + logtag + ' does contain neither display name nor username.' });
		}

		// create query condition
		var providerMatch = {};
		providerMatch[provider + '.id'] = profile.id;
		var condition = [ providerMatch, { 'email': profile.emails[0].value } ];

		logger.info('[passport|%s] Checking for existing user: %s', logtag, JSON.stringify(condition));
		User.findOne().or(condition).exec(function(err, user) {

			/*
			 * FIXME
			 *
			 * In theory we can have multiple hits here:
			 *  1. User signs up with email1 (entry 1 created with email1)
			 *  2. User authenticates via GitHub with email2 (entry 2 created with email2)
			 *  3. User changes email2 on GitHub to email1
			 *  4. User again authenticates via GitHub. We'll get 2 rows now:
			 *     1. Entry 1 through match by email1
			 *     2. Entry 2 through match by GitHub ID
			 *
			 *  (Order of 1. and 2. is interchangeable.)
			 *  Right now, one of two things happens:
			 *
			 *  - If entry 1 happens to be the first returned, the local entry 1
			 *    will be extended with the GitHub profile and user is logged locally.
			 *  - If entry 2 happens to be the one, entry 2 will have its email
			 *    updated, resulting in two entries with the same email in the
			 *    database (or more likely, a unique constraint exception).
			 *
			 *  The "quick" solution would be to make sure to treat only entry 1,
			 *  resulting in entry 2 becoming a zombie.
			 *  The "right" solution would be to merge the two profiles.
			 */

			if (err) {
				logger.error('[passport|%s] Error checking for user <%s> in database: %s', logtag, profile.emails[0].value, err, {});
				return done(err);
			}
			if (!user) {
				var newUser = {
					provider: provider,
					name: profile.displayName || profile.username,
					email: profile.emails[0].value
				};
				// optional data
				if (profile.photos && profile.photos.length > 0) {
					newUser.thumb = profile.photos[0].value;
				}
				newUser[provider] = profile._json; // save original data to separate field

				User.createUser(newUser, function(err, user, validationErr) {
					if (err) {
						return done(err);
					}
					if (validationErr) {
						logger.error('[passport|%s] Validation error for user from "%s". This should not be happening.', logtag, logtag, err);
						return done('Validation error.');
					}
					done(null, user);
				});

			} else {
				if (!user[provider]) {
					logger.info('[passport|%s] Adding profile from %s to user.', logtag, provider, profile.emails[0].value);
				} else {
					logger.info('[passport|%s] Returning user %s', logtag, profile.emails[0].value);
				}

				// update profile data on separate field
				user[provider] = profile._json;

				// optional data
				if (!user.thumb && profile.photos && profile.photos.length > 0) {
					user.thumb = profile.photos[0].value;
				}

				// save and return
				user.save(function(err, user) {
					if (err) {
						logger.error('[passport|%s] Error updating user: %s', logtag, err);
						return done(err);
					}

					// all good.
					done(null, user);
				});
			}
		});
	};
};
