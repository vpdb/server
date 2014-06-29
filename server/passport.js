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

	// oauth callback
	var updateProfile = function(strategy, providerName) {
		var provider = providerName ? providerName : strategy;
		return function(accessToken, refreshToken, profile, done) {
			profile.id = profile.id.toString(); // types must be equal when matching in mongodb
			var providerMatch = {};
			providerMatch[provider + '.id'] = profile.id;
			User.findOne().or([providerMatch, {'email': profile.emails[0].value }]).exec(function(err, user) {
				var logtag = providerName ? strategy + ':' + providerName : strategy;
				if (err) {
					logger.error('[passport|%s] Error checking for user <%s> in database: %s', logtag, profile.emails[0].value, err, {});
					return done(err);
				}
				if (!user) {
					User.count(function(err, count) {
						if (err) {
							logger.error('[passport|%s] Error counting users: %s', logtag, err, {});
							return done(err);
						}
						logger.info('[passport|%s] Saving %s user %s <%s>', logtag, count ? 'new' : 'first', profile.username, profile.emails[0].value);

						// mandatory data
						user = new User({
							name: profile.displayName,
							email: profile.emails[0].value,
							provider: provider,
							roles: count ? [ 'member' ] : [ 'root' ],
							plan: count ? settings.vpdb.quota.defaultPlan : 'unlimited'
						});

						// save original data to separate field
						user[provider] = profile._json;
						user[provider].id = profile._json.id.toString();

						// optional data
						if (profile.photos && profile.photos.length > 0) {
							user.thumb = profile.photos[0].value;
						}

						// now save and return
						user.save(function(err) {
							if (err) {
								logger.error('[passport|%s] Error creating user: %s', logtag, err);
							}
							return done(err, user);
						});
					});
				} else {
					if (!user[provider]) {
						logger.info('[passport|%s] Adding profile from %s to user.', logtag, provider, profile.emails[0].value);
					} else {
						logger.info('[passport|%s] Returning user %s', logtag, profile.emails[0].value);
					}

					// update profile data on separate field
					user[provider] = profile._json;
					user[provider].id = profile._json.id.toString();

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

	// use github strategy
	if (config.vpdb.passport.github.enabled) {
		logger.info('[passport] Enabling GitHub authentication strategy.');
		passport.use(new GitHubStrategy({
				clientID: config.vpdb.passport.github.clientID,
				clientSecret: config.vpdb.passport.github.clientSecret,
				callbackURL: settings.publicUrl(config) + '/auth/github/callback'
			}, updateProfile('github'))
		);
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
				}, updateProfile('ipboard', ipbConfig.id))
			);
		}
	});
};
