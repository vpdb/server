var _ = require('underscore');
var util = require('util');
var logger = require('winston');
var request = require('request');
var mongoose = require('mongoose');
var LocalStrategy = require('passport-local').Strategy;
var GitHubStrategy = require('passport-github').Strategy;

var settings = require('./modules/settings');
var User = mongoose.model('User');

/**
 * Defines the authentication strategies and user serialization.
 *
 * @param passport Passport module
 * @param config Passport configuration from settings
 */
module.exports = function(passport, config) {

	// serialize sessions
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		User.findOne({ _id: id }, function(err, user) {
			done(err, user);
		})
	});

	// use local strategy
	passport.use(new LocalStrategy({
			usernameField: 'email',
			passwordField: 'password'
		},
		function(email, password, done) {
			User.findOne({ email: email }, function(err, user) {
				if (err) {
					return done(err);
				}
				if (!user) {
					return done(null, false, { message: 'Unknown user' });
				}
				if (!user.authenticate(password)) {
					return done(null, false, { message: 'Invalid password' });
				}
				return done(null, user);
			});
		}
	));

	// use github strategy
	if (config.vpdb.passport.github.enabled) {
		logger.info('[passport] Enabling GitHub authentication strategy.');
		passport.use(new GitHubStrategy({
				clientID: config.vpdb.passport.github.clientID,
				clientSecret: config.vpdb.passport.github.clientSecret,
				callbackURL: settings.publicUrl(config) + '/auth/github/callback'
			},
			function (accessToken, refreshToken, profile, done) {
				User.findOne({ 'github.id': profile.id }, function (err, user) {
					if (!user) {
						logger.info('[passport|github] Saving new user %s', profile.emails[0].value);
						user = new User({
							name: profile.displayName, email: profile.emails[0].value, username: profile.username, provider: 'github', github: profile._json
						});
						user.save(function (err) {
							if (err) {
								logger.error('[passport|github] Error saving user: %s', err);
							}
							return done(err, user);
						});
					} else {
						logger.info('[passport|github] Returning user %s', profile.emails[0].value);
						return done(err, user);
					}
				});
			}
		));
	}

	// ipboard strategies
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
			var callbackUrl = settings.publicUrl(config) + '/auth/' +  ipbConfig.id + '/callback';
			logger.info('[passport|ipboard:' + ipbConfig.id + '] Enabling IP.Board authentication strategy for "%s" with callback %s.', ipbConfig.name, callbackUrl);
			passport.use(ipbConfig.id, new OAuth2Strategy({
					authorizationURL: ipbConfig.baseURL + '?app=oauth2&module=server&section=authorize',
					tokenURL: ipbConfig.baseURL + '?app=oauth2&module=server&section=token',
					clientID: ipbConfig.clientID,
					clientSecret: ipbConfig.clientSecret,
					callbackURL: callbackUrl,
					state: true
				},
				function (accessToken, refreshToken, profile, done) {
					if (!accessToken) {
						logger.warn('[passport|ipboard:' + ipbConfig.id + '] No access token received from IP.Board "%s", aborting login.');
						return done('No access token received from IP.Board.');
					}
					logger.info('[passport|ipboard:' + ipbConfig.id + '] Getting profile data...');
					var req = {
						url: ipbConfig.baseURL + '?app=oauth2&module=server&section=profile',
						json: true,
						headers: {
							'Authorization': 'Bearer ' + accessToken
						}
					};
					request(req, function(err, response, result) {
						if (err) {
							logger.error('[passport|ipboard:' + ipbConfig.id + '] Error getting profile data: %s', err);
							return done(err);
						}
						if (response.statusCode == 200) {
							if (result.success) {
								logger.info('[passport] Successfully retrieved user profile: %s', util.inspect(result, false, 3, true));
								done(null, {
									provider: ipbConfig.id,
									id: parseInt(result.member.id),
									username: result.member.username,
									displayName: result.member.displayName,
									profileUrl: result.member.profileUrl,
									emails: [{ value: result.member.email }],
									photos: [{ value: result.member.avatar.thumb.url }],
									_raw: JSON.stringify(body),
									_json: body
								});
							} else {
								logger.error('[passport|ipboard:' + ipbConfig.id + '] Error getting profile data: %s', result.message);
								done(result.message);
							}
						} else {
							logger.error('[passport|ipboard:' + ipbConfig.id + '] Error getting profile data (%d): %s', response.statusCode, result);
							done('Status code is ' + response.statusCode + ', expected 200.');
						}
					});
				}
			));
		}
	});

};
