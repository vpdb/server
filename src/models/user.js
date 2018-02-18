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
const crypto = require('crypto');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');
const validator = require('validator');
const randomstring = require('randomstring');
const uniqueValidator = require('mongoose-unique-validator');
const metrics = require('./plugins/metrics');

const config = require('../modules/settings').current;
const flavor = require('../modules/flavor');
const Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering.
	username: { type: String, index: true, unique: true, sparse: true },         // login name when logging locally, empty if oauth
	email: { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	email_status: {
		code: { type: String, 'enum': ['confirmed', 'pending_registration', 'pending_update'], required: true },
		token: { type: String },
		expires_at: { type: Date },
		value: { type: String }
	},
	emails: { type: [String] }, // collected from profiles
	roles: { type: [String], required: true },
	_plan: { type: String, required: true },
	provider: { type: String, required: true },
	password_hash: { type: String },
	password_salt: { type: String },
	thumb: { type: String },
	location: { type: String },
	preferences: {
		tablefile_name: { type: String },
		flavor_tags: { type: Schema.Types.Mixed },
		notify_release_moderation_status: { type: Boolean, 'default': true },
		notify_release_validation_status: { type: Boolean, 'default': true },
		notify_backglass_moderation_status: { type: Boolean, 'default': true },
		notify_game_requests: { type: Boolean, 'default': true },
		notify_created_release_comments: { type: Boolean, 'default': true },
		notify_created_release_followers: { type: Boolean, 'default': true }, // not implemented
		notify_mentions: { type: Boolean, 'default': true },                  // not implemented
		contributor_notify_game_request_created: { type: Boolean, 'default': true }, // not implemented
		moderator_notify_release_submitted: { type: Boolean, 'default': true },
		moderator_notify_release_auto_approved: { type: Boolean, 'default': false },
		moderator_notify_release_commented: { type: Boolean, 'default': true },
		moderator_notify_backglass_submitted: { type: Boolean, 'default': true },
		moderator_notify_backglass_auto_approved: { type: Boolean, 'default': false }
	},
	credits: { type: Schema.Types.Number },
	counter: {
		comments: { type: Number, 'default': 0 },
		downloads: { type: Number, 'default': 0 },
		stars: { type: Number, 'default': 0 }
	},
	created_at: { type: Date, required: true },
	is_active: { type: Boolean, required: true, 'default': false },
	validated_emails: { type: [String] },
	channel_config: {
		subscribe_to_starred: { type: Boolean, 'default': false }, // "nice to know", useless
		subscribed_releases: { type: [String], index: true }     // linked releases on client side, so we can announce properly in realtime
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
const UserSchema = new Schema(fields, { usePushEach: true });
UserSchema.index({ name: 'text', username: 'text', email: 'text' });
UserSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------

UserSchema.plugin(metrics);


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

UserSchema.virtual('planConfig')
	.get(function() {
		let plan = _.find(config.vpdb.quota.plans, p => p.id === this._plan);
		if (!plan) {
			logger.warn('[model|user] Cannot find plan "%s" for user "%s" in server config.', this._plan, this.email);
			plan = _.find(config.vpdb.quota.plans, p => p.id === config.vpdb.quota.defaultPlan);
		}
		return plan;
	});


//-----------------------------------------------------------------------------
// MIDDLEWARE
//-----------------------------------------------------------------------------

UserSchema.pre('validate', function(next) {
	const user = this.toJSON();
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
const validNameRegex = /^[0-9a-z ]{3,}$/i;
UserSchema.path('name').validate(function(name) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return _.isString(name) && validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('name').validate(function(name) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return validNameRegex.test(name);
}, 'Name can only contain letters, numbers and spaces.');

UserSchema.path('email').validate(function(email) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.isNew && this.provider !== 'local') {
		return true;
	}
	return _.isString(email) && validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('email').validate(function(email) {
	return Promise.try(() => {
		if (!email) {
			return true;
		}
		return mongoose.model('User').findOne({ 'email_status.value': email }).exec();

	}).then(u => !u || u.id === this.id);

}, 'The {PATH} "{VALUE}" is already taken.');

UserSchema.path('location').validate(function(location) {
	return _.isString(location) && validator.isLength(location, 0, 100);
}, 'Location must not be longer than 100 characters.');

UserSchema.path('provider').validate(function(provider) {

	return Promise.try(() => {

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
			if (!_.isString(this.username)) {
				this.invalidate('username', 'Username must be a string between 3 and 30 characters.');
			} else {
				if (!validator.isLength(this.username, 3, 30)) {
					this.invalidate('username', 'Username must be between 3 and 30 characters.');
				}
				if (!validator.matches(this.username, /^[a-z0-9]+$/i)) {
					this.invalidate('username', 'Username must only contain alpha-numeric characters.');
				}
			}
		}

		// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
		if (this.preferences && this.preferences.tablefile_name) {
			if (!this.preferences.tablefile_name.trim()) {
				this.invalidate('preferences.tablefile_name', 'Must not be empty if set.');
			}
			let rg1 = /^[^\\/:*?"<>|]+$/;                        // forbidden characters \ / : * ? " < > |
			let rg2 = /^\./;                                     // cannot start with dot (.)
			let rg3 = /^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i; // forbidden file names
			if (!rg1.test(this.preferences.tablefile_name) || rg2.test(this.preferences.tablefile_name) || rg3.test(this.preferences.tablefile_name)) {
				this.invalidate('preferences.tablefile_name', 'Must be a valid windows filename, which "' + this.preferences.tablefile_name + '" is not.');
			}
		}
		if (this.preferences && this.preferences.flavor_tags) {
			_.each(flavor.values, (flavorType, flavorId) => {  // flavorId: 'orientation', flavorType: { fs: { name: 'Portrait', .. }, ws: { ... } }
				if (this.preferences.flavor_tags[ flavorId ]) {
					_.each(flavorType, (flavorAttrs, flavorValue) => { // flavorValue: 'fs', flavorAttrs: { name: 'Portrait', .. }
						if (_.isUndefined(this.preferences.flavor_tags[ flavorId ][ flavorValue ])) {
							this.invalidate('preferences.flavor_tags.' + flavorId + '.' + flavorValue, 'Must be provided when providing preferences.flavor_tags.' + flavorId + '.');
						}
					});
				} else {
					this.invalidate('preferences.flavor_tags.' + flavorId, 'Must be provided when providing preferences.flavor_tags.');
				}
			});
		}

		if (this.preferences && this.preferences.notify_release_moderation_status) {
			if (!_.isBoolean(this.preferences.notify_release_moderation_status)) {
				this.invalidate('preferences.notify_release_moderation_status', 'Must be a boolean.');
			}
		}
		if (this.preferences && this.preferences.notify_backglass_moderation_status) {
			if (!_.isBoolean(this.preferences.notify_backglass_moderation_status)) {
				this.invalidate('preferences.notify_backglass_moderation_status', 'Must be a boolean.');
			}
		}

		// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
		if (this.channel_config && this.channel_config.subscribed_releases) {
			if (!_.isArray(this.channel_config.subscribed_releases)) {
				this.invalidate('channel_config.subscribed_releases', 'Must be an array of release IDs.');
				return;
			}
			let i = 0;
			const Release = mongoose.model('Release');
			return Promise.each(this.channel_config.subscribed_releases, releaseId => {
				return Release.findOne({ id: releaseId }).exec().then(rls => {
					if (!rls) {
						this.invalidate('channel_config.subscribed_releases.' + i, 'Release with ID "' + releaseId + '" does not exist.');
					}
					i++;
				});

			});
		}
		return null;

	}).then(() => true);

}, null);

UserSchema.path('password_hash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this._password && _.isString(this._password) && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);

UserSchema.path('_plan').validate(function(plan) {
	return _.includes(config.vpdb.quota.plans.map(p => p.id), plan);
}, 'Plan must be one of: [' +  config.vpdb.quota.plans.map(p => p.id).join(',') + ']');


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
	if (!this.password_salt) {
		return '';
	}
	return crypto.createHmac('sha1', this.password_salt).update(password).digest('hex');
};

UserSchema.methods.passwordSet = function() {
	return this.password_salt && this.password_hash;
};

UserSchema.methods.hasRole = function(role) {
	if (_.isArray(role)) {
		for (let i = 0; i < role.length; i++) {
			if (this.roles.includes(role[i])) {
				return true;
			}
		}
		return false;

	} else {
		return this.roles.includes(role);
	}
};


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

UserSchema.statics.createUser = function(userObj, confirmUserEmail) {

	const User = mongoose.model('User');

	let user, count;
	return Promise.try(() => {
		user = new User(_.extend(userObj, {
			created_at: new Date(),
			roles: ['member'],
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
			user.validated_emails = [userObj.email];
		}
		return user.validate();

	}).then(() => {
		return User.count().exec();

	}).then(c => {
		count = c;
		user.roles = count ? [ 'member' ] : [ 'root' ];
		return user.save();

	}).then(u => {
		user = u;
		return require('../acl').addUserRoles(user.id, user.roles);

	}).then(() => {
		logger.info('[model|user] %s <%s> successfully created with ID "%s" and plan "%s".', count ? 'User' : 'Root user', user.email, user.id, user._plan);
		return user;
	});
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
UserSchema.post('remove', function(obj, done) {

	const acl = require('../acl');
	const LogUser = mongoose.model('LogUser');
	const Token = mongoose.model('Token');
	return Promise
		.try(() => LogUser.remove({ _user: obj._id }))
		.then(() => Token.remove({ _created_by: obj._id }))
		.then(() => acl.removeUserRoles(obj.id, obj.roles))
		.nodeify(done);
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
UserSchema.options.toObject = { virtuals: true, versionKey: false };


mongoose.model('User', UserSchema);
logger.info('[model] Schema "User" registered.');