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
exports.init = function(config, passport) {

	// use github strategy
	if (config.vpdb.passport.github.enabled) {
		logger.info('[passport] Enabling GitHub authentication strategy.');
		passport.use(new GitHubStrategy({
				clientID: config.vpdb.passport.github.clientID,
				clientSecret: config.vpdb.passport.github.clientSecret,
				callbackURL: settings.publicUrl(config) + '/auth/github/callback'
			}, exports.updateProfile('github')
		));
	}

	// ipboard strategies
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {

			var callbackUrl = settings.publicUrl(config) + '/auth/' +  ipbConfig.id + '/callback';
			logger.info('[passport|ipboard:' + ipbConfig.id + '] Enabling IP.Board authentication strategy for "%s".', ipbConfig.name);
			passport.use(new IPBoardStrategy({
					name: ipbConfig.id,
					baseURL: ipbConfig.baseURL,
					clientID: ipbConfig.clientID,
					clientSecret: ipbConfig.clientSecret,
					callbackURL: callbackUrl
				}, exports.updateProfile('ipboard', ipbConfig.id)
			));
		}
	});
};

exports.updateProfile = function(strategy, providerName) {
	var provider = providerName ? providerName : strategy;
	var logtag = providerName ? strategy + ':' + providerName : strategy;

	return function(accessToken, refreshToken, profile, done) {

		var providerMatch = {};
		providerMatch[provider + '.id'] = profile.id;
		var condition = [providerMatch, {'email': profile.emails[0].value }];
		logger.info('[passport|%s] Checking for existing user: %s', logtag, JSON.stringify(condition));

		User.findOne().or(condition).exec(function(err, user) {

			if (err) {
				logger.error('[passport|%s] Error checking for user <%s> in database: %s', logtag, profile.emails[0].value, err, {});
				return done(err);
			}
			if (!user) {

				var newUser = {
					provider: provider,
					name: profile.displayName || profile.username,
					email: profile.emails[0].value,
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
				user.save(function(err) {
					if (err) {
						logger.error('[passport|%s] Error updating user: %s', logtag, err);
					}
					return done(err, user);
				});
			}
		});
	};
};
