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

"use strict";

var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var logger = require('winston');
var shortId = require('shortid32');
var mongoose = require('mongoose');
var validator = require('validator');
var randomstring = require('randomstring');
var uniqueValidator = require('mongoose-unique-validator');
var toObj = require('./plugins/to-object');
var metrics = require('./plugins/metrics');

var error = require('../modules/error')('model', 'user');
var config = require('../modules/settings').current;
var flavor = require('../modules/flavor');
var pusher = require('../modules/pusher');
var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:               { type: String, required: true, unique: true, 'default': shortId.generate },
	name:             { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering
	username:         { type: String, index: true, unique: true, sparse: true },
	email:            { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	email_status: {
		code:         { type: String, 'enum': [ 'confirmed', 'pending_registration', 'pending_update' ], required: true },
		token:        { type: String },
		expires_at:   { type: Date },
		value:        { type: String }
	},
	roles:            { type: [ String ], required: true },
	_plan:            { type: String, required: true },
	provider:         { type: String, required: true },
	password_hash:    { type: String },
	password_salt:    { type: String },
	thumb:            { type: String },
	location:         { type: String },
	preferences:      {
		tablefile_name: { type: String },
		flavor_tags:    { type: Schema.Types.Mixed }
	},
	credits: { type: Schema.Types.Number },
	counter: {
		comments:     { type: Number, 'default': 0 },
		downloads:    { type: Number, 'default': 0 },
		stars:        { type: Number, 'default': 0 }
	},
	created_at:       { type: Date, required: true },
	is_active:        { type: Boolean, required: true, 'default': false },
	validated_emails: { type: [ String ] },
	channel_config:   {
		subscribe_to_starred: { type: Boolean, 'default': false }, // "nice to know", useless
		subscribed_releases: { type: [ String ], index: true }     // linked releases on client side, so we can announce properly in realtime
	}
};

// provider data fields
if (config.vpdb.passport.github.enabled) {
	fields.github = {};
}
if (config.vpdb.passport.google.enabled) {
	fields.google = {};
}
config.vpdb.passport.ipboard.forEach(function(ipbConfig) {
	if (ipbConfig.enabled) {
		fields[ipbConfig.id] = {};
	}
});
var UserSchema = new Schema(fields);
UserSchema.index({ name: 'text', username: 'text', email: 'text' });
UserSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
UserSchema.plugin(toObj);
UserSchema.plugin(metrics);

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	reduced: [ 'id', 'name', 'username', 'thumb', 'gravatar_id', 'location' ], // "member" search result
	simple: [ 'email', 'is_active', 'provider', 'roles', 'plan', 'created_at', 'google', 'github', 'preferences', 'counter' ]  // "admin" lists & profile
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
UserSchema.virtual('password')
	.set(function(password) {
		this._password = password;
		this.password_salt = this.makeSalt();
		this.password_hash = this.hashPassword(password);
	})
	.get(function() {
		return this._password;
	});

UserSchema.virtual('gravatar_id')
	.get(function() {
		return this.email ? crypto.createHash('md5').update(this.email.toLowerCase()).digest('hex') : null;
	});

UserSchema.virtual('plan')
	.get(function() {
		if (this._plan) {
			var plan = config.vpdb.quota.plans[this._plan];
			return {
				id: this._plan,
				app_tokens_enabled: plan.enableAppTokens,
				push_notifications_enabled: plan.enableRealtime
			};
		}
		return null;
	});


//-----------------------------------------------------------------------------
// MIDDLEWARE
//-----------------------------------------------------------------------------
UserSchema.pre('validate', function(next) {
	var user = this.toJSON();
	if (this.isNew && !this.name) {
		if (user.username) {
			this.name = user.username;
		}
		if (!_.isEmpty(user.github)) {
			this.name = user.github.name ? user.github.name : user.github.login;
		}
		if (!_.isEmpty(user.google)) {
			this.name = user.google.name ? user.google.name : user.google.login;
		}
		config.vpdb.passport.ipboard.forEach(function(ipbConfig) {
			if (!_.isEmpty(user[ipbConfig.id])) {
				this.name = user[ipbConfig.id].displayName ? user[ipbConfig.id].displayName : user[ipbConfig.id].username;
			}
		}, this);
	}
	next();
});


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
UserSchema.path('name').validate(function(name) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('email').validate(function(email) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.isNew && this.provider !== 'local') {
		return true;
	}
	return validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('email').validate(function(email, callback) {
	if (!email) {
		return callback(true);
	}
	var that = this;

	mongoose.model('User').findOne({ 'email_status.value': email }, function(err, u) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[model|user] Error fetching user %s.', email);
			return callback(false);
		}
		callback(!u || u.id === that.id);
	});
}, 'The {PATH} "{VALUE}" is already taken.');

UserSchema.path('location').validate(function(location) {
	return validator.isLength(location, 0, 100);
}, 'Location must not be longer than 100 characters.');

UserSchema.path('provider').validate(function(provider, callback) {
	var that = this;

	// validate presence of password. can't do that in the password validator
	// below because it's not run when there's no value (and it can be null,
	// if auth strategy is not local). so do it here, invalidate password if
	// necessary but return true so provider passes.
	if (this.isNew && provider === 'local') {
		if (!this._password) {
			this.invalidate('password', 'Password is required.');
		}
		// idem for username and email
		if (!this.username) {
			this.invalidate('username', 'Username is required.');
		}
		if (!this.email) {
			this.invalidate('email', 'Email is required.');
		}
	}
	if (provider === 'local') {
		if (!validator.isLength(this.username, 3, 30)) {
			this.invalidate('username', 'Length of username must be between 3 and 30 characters.');
		}
		if (!validator.matches(this.username, /^[a-z0-9\._]+$/i)) {
			this.invalidate('username', 'Username must only contain alpha-numeric characters including dot and underscore.');
		}
	}

	// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
	if (this.preferences && this.preferences.tablefile_name) {
		if (!this.preferences.tablefile_name.trim()) {
			console.log('validation for name failed.');
			this.invalidate('preferences.tablefile_name', 'Must not be empty if set.');
		}
		var rg1 = /^[^\\/:\*\?"<>\|]+$/;                     // forbidden characters \ / : * ? " < > |
		var rg2 = /^\./;                                     // cannot start with dot (.)
		var rg3 = /^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i; // forbidden file names
		if (!rg1.test(this.preferences.tablefile_name) || rg2.test(this.preferences.tablefile_name) || rg3.test(this.preferences.tablefile_name)) {
			this.invalidate('preferences.tablefile_name', 'Must be a valid windows filename, which "' + this.preferences.tablefile_name + '" is not.');
		}
	}
	if (this.preferences && this.preferences.flavor_tags) {
		_.each(flavor.values, function(flavorType, flavorId) {  // flavorId: 'orientation', flavorType: { fs: { name: 'Portrait', .. }, ws: { ... } }
			if (that.preferences.flavor_tags[flavorId]) {
				_.each(flavorType, function(flavorAttrs, flavorValue) { // flavorValue: 'fs', flavorAttrs: { name: 'Portrait', .. }
					if (_.isUndefined(that.preferences.flavor_tags[flavorId][flavorValue])) {
						that.invalidate('preferences.flavor_tags.' + flavorId + '.' + flavorValue, 'Must be provided when providing preferences.flavor_tags.' + flavorId + '.');
					}
				});
			} else {
				that.invalidate('preferences.flavor_tags.' + flavorId, 'Must be provided when providing preferences.flavor_tags.');
			}
		});
	}

	async.waterfall([
		function(next) {

			// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
			if (that.channel_config && that.channel_config.subscribed_releases) {
				if (!_.isArray(that.channel_config.subscribed_releases)) {
					that.invalidate('channel_config.subscribed_releases', 'Must be an array of release IDs.');
					return next();
				}
				var i = 0;
				var Release = mongoose.model('Release');
				async.each(that.channel_config.subscribed_releases, function(releaseId, next) {
					Release.findOne({ id: releaseId }, function(err, rls) {
						/* istanbul ignore if  */
						if (err) {
							logger.error('[model|user] Error fetching release %s.', releaseId);
						} else if (!rls) {
							that.invalidate('channel_config.subscribed_releases.' + i, 'Release with ID "' + releaseId + '" does not exist.');
						}
						i++;
						next();
					});

				}, next);

			} else {
				next();
			}
		}
	], function() {
		callback(true);
	});

}, null);

UserSchema.path('password_hash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this._password && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);

UserSchema.path('_plan').validate(function(plan) {
	return _.includes(_.keys(config.vpdb.quota.plans), plan);
}, 'Plan must be one of: [' + _.keys(config.vpdb.quota.plans).join(',') + ']');


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Authenticate - check if the passwords are the same
 *
 * @param {String} plainText
 * @return {Boolean}
 * @api public
 */
UserSchema.methods.authenticate = function(plainText) {
	return this.hashPassword(plainText) === this.password_hash;
};

/**
 * Make salt
 *
 * @return {String}
 * @api public
 */
UserSchema.methods.makeSalt = function() {
	return Math.round((new Date().valueOf() * Math.random())) + '';
};

/**
 * Encrypt password
 *
 * @param {String} password
 * @return {String}
 * @api public
 */
UserSchema.methods.hashPassword = function(password) {
	if (!password) {
		return '';
	}
	return crypto.createHmac('sha1', this.password_salt).update(password).digest('hex');
};

UserSchema.methods.toReduced = function() {
	return UserSchema.statics.toReduced(this);
};

UserSchema.methods.toSimple = function() {
	return UserSchema.statics.toSimple(this);
};

UserSchema.methods.toDetailed = function() {
	return UserSchema.statics.toDetailed(this);
};


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

UserSchema.statics.createUser = function(userObj, confirmUserEmail, done) {

	var User = mongoose.model('User');
	var LogUser = mongoose.model('LogUser');

	var user = new User(_.extend(userObj, {
		created_at: new Date(),
		roles: [ 'member' ],
		_plan: config.vpdb.quota.defaultPlan
	}));

	if (confirmUserEmail) {
		user.email_status = {
			code: 'pending_registration',
			token: randomstring.generate(16),
			expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
			value: userObj.email
		};
	} else {
		user.email_status = { code: 'confirmed' };
		user.is_active = true;
		user.validated_emails = [ userObj.email ];
	}

	user.validate(function(err) {
		if (err) {
			return done(null, null, err);
		}
		User.count(function(err, count) {
			/* istanbul ignore if  */
			if (err) {
				return done(error(err, 'Error counting users').log());
			}

			user.roles = count ? [ 'member' ] : [ 'root' ];

			user.save(function(err) {
				/* istanbul ignore if  */
				if (err) {
					return done(error(err, 'Error saving user <%s>', user.email).log());
				}
				require('../acl').addUserRoles(user.id, user.roles, function(err) {
					/* istanbul ignore if  */
					if (err) {
						return done(error(err, 'Error updating ACLs for <%s>', user.email).log());
					}
					logger.info('[model|user] %s <%s> successfully created with ID "%s" and plan "%s".', count ? 'User' : 'Root user', user.email, user.id, user._plan);
					done(null, user);
				});
			});
		});
	});
};
UserSchema.statics.toReduced = function(user) {
	if (!user) {
		return user;
	}
	var obj = user.toObj ? user.toObj() : user;
	return _.extend(_.pick(obj, apiFields.reduced), { counter: _.pick(obj.counter, ['comments', 'stars'] ) });
};

UserSchema.statics.toSimple = function(user) {
	var obj = user.toObj ? user.toObj() : user;
	user = _.pick(obj, apiFields.reduced.concat(apiFields.simple));
	if (!_.isEmpty(user.github)) {
		user.github = UserSchema.statics.normalizeProviderData('github', user.github);
	}
	if (!_.isEmpty(user.google)) {
		user.google = UserSchema.statics.normalizeProviderData('google', user.google);
	}
	return user;
};

UserSchema.statics.toDetailed = function(user) {
	user = user.toObj ? user.toObj() : user;
	if (!_.isEmpty(user.github)) {
		user.github = UserSchema.statics.normalizeProviderData('github', user.github);
	}
	if (!_.isEmpty(user.google)) {
		user.google = UserSchema.statics.normalizeProviderData('google', user.google);
	}
	return user;
};

UserSchema.statics.normalizeProviderData = function(provider, data) {
	switch (provider) {
		case 'github':
			return {
				id: data.id,
				username: data.login,
				email: data.email,
				avatar_url: data.avatar_url,
				html_url: data.html_url
			};
		case 'google':
			return {
				id: data.id,
				username: data.login,
				email: data.email,
				avatar_url: data.avatar_url,
				html_url: data.html_url
			};
	}
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
UserSchema.post('remove', function(obj, done) {
	// also remove logs and tokens
	var LogUser = mongoose.model('LogUser');
	LogUser.remove({ _user: obj._id }, function() {
		var Token = mongoose.model('Token');
		Token.remove({ _created_by: obj._id }, done);
	});
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
UserSchema.options.toObject = {
	virtuals: true,
	transform: function(doc, user) {

		if (pusher.isUserEnabled(user)) {
			user.channel_config.api_key = config.vpdb.pusher.options.key;
		} else {
			delete user.channel_config;
		}
		delete user._id;
		delete user.__v;
		delete user._plan;
		delete user.password_hash;
		delete user.password_salt;
		delete user.password;
		delete user.validated_emails;
		if (user.email_status.code === 'confirmed') {
			delete user.email_status;
		} else {
			delete user.email_status.token;
		}
	}
};


mongoose.model('User', UserSchema);
logger.info('[model] Schema "User" registered.');