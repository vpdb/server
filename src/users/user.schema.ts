/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import mongoose = require('mongoose');
import { Schema } from 'mongoose';
import { each, find, isArray, isBoolean, isString, isUndefined, keys } from 'lodash';
import { createHmac } from 'crypto';
import validator from 'validator';
import uniqueValidator from 'mongoose-unique-validator';
import { logger } from '../common/logger';
import { config } from '../common/settings';

import { User } from './user';
import { server } from '../server';
import { flavors } from '../releases/release.flavors';

const shortId = require('shortid32');
const metrics = require('../common/mongoose-plugins/metrics');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields: any = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering.
	username: { type: String, index: true, unique: true, sparse: true },     // login name when logging locally, empty if oauth
	email: { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	email_status: {
		code: { type: String, 'enum': ['confirmed', 'pending_registration', 'pending_update'], required: true },
		token: { type: String },
		expires_at: { type: Date },
		value: { type: String }
	},
	emails: { type: [String], index: true }, // collected from profiles
	roles: { type: [String], required: 'Roles must be provided.' },
	_plan: { type: String, required: 'Plan must be provided.' },
	is_local: { type: Boolean, required: true },
	providers: {},
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
	validated_emails: { type: [String], index: true },
	channel_config: {
		subscribe_to_starred: { type: Boolean, 'default': false }, // "nice to know", useless
		subscribed_releases: { type: [String], index: true }     // linked releases on client side, so we can announce properly in realtime
	}
};
const providerSchema = new mongoose.Schema({
	id: { type: String, required: 'Provider ID is required.', index: true },
	name: { type: String },
	emails: { type: [String], required: false },
	created_at: { type: Date, required: true },
	modified_at: { type: Date },
	profile: {}
});

// provider data fields
if (config.vpdb.passport.github.enabled) {
	fields.providers.github = providerSchema;
}
if (config.vpdb.passport.google.enabled) {
	fields.providers.google = providerSchema;
}
config.vpdb.passport.ipboard.forEach(function (ipbConfig) {
	if (ipbConfig.enabled) {
		fields.providers[ipbConfig.id] = providerSchema;
	}
});
const UserSchema = new Schema(fields, { toObject: { virtuals: true, versionKey: false } });
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
	.set(function (password: string) {
		this._password = password;
		this.password_salt = this.makeSalt();
		this.password_hash = this.hashPassword(password);
	})
	.get(function () {
		return this._password;
	});

UserSchema.virtual('planConfig')
	.get(function () {
		let plan = find(config.vpdb.quota.plans, p => p.id === this._plan);
		if (!plan) {
			logger.warn('[model|user] Cannot find plan "%s" for user "%s" in server config.', this._plan, this.email);
			plan = find(config.vpdb.quota.plans, p => p.id === config.vpdb.quota.defaultPlan);
		}
		return plan;
	});

UserSchema.virtual('provider')
	.get(function () {
		return find(keys(this.providers), p => this.providers[p] && this.providers[p].id) || 'local';
	});

//-----------------------------------------------------------------------------
// MIDDLEWARE
//-----------------------------------------------------------------------------

// UserSchema.pre('validate', function(next) {
// 	const user = this.toJSON();
// 	if (this.isNew && !this.name) {
// 		if (user.username) {
// 			this.name = user.username;
// 		}
// 		// if (user.providers && !_.isEmpty(user.providers.github)) {
// 		// 	this.name = user.github.name ? user.providers.github.name : user.providers.github.login;
// 		// }
// 		// if (user.providers && !_.isEmpty(user.providers.google)) {
// 		// 	this.name = user.google.name ? user.google.name : user.google.login;
// 		// }
// 		// config.vpdb.passport.ipboard.forEach(function(ipbConfig) {
// 		// 	if (!_.isEmpty(user[ipbConfig.id])) {
// 		// 		this.name = user[ipbConfig.id].displayName ? user[ipbConfig.id].displayName : user[ipbConfig.id].username;
// 		// 	}
// 		// }, this);
// 	}
// 	next();
// });


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
const validNameRegex = /^[0-9a-z ]{3,}$/i;
UserSchema.path('name').validate(function (name: string) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return isString(name) && validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('name').validate(function (name: string) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return validNameRegex.test(name);
}, 'Name can only contain letters, numbers and spaces.');

UserSchema.path('email').validate(function (email: string) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.isNew && !this.is_local) {
		return true;
	}
	return isString(email) && validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('location').validate(function (location: string) {
	return isString(location) && validator.isLength(location, 0, 100);
}, 'Location must not be longer than 100 characters.');

UserSchema.path('is_local').validate(async function (isLocal: boolean) {

	// validate presence of password. can't do that in the password validator
	// below because it's not run when there's no value (and it can be null,
	// if auth strategy is not local). so do it here, invalidate password if
	// necessary but return true so provider passes.
	if (this.isNew && isLocal) {
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
	if (isLocal) {
		if (!isString(this.username)) {
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
		each(flavors.values, (flavorType, flavorId) => {  // flavorId: 'orientation', flavorType: { fs: { name: 'Portrait', .. }, ws: { ... } }
			if (this.preferences.flavor_tags[flavorId]) {
				each(flavorType, (flavorAttrs, flavorValue) => { // flavorValue: 'fs', flavorAttrs: { name: 'Portrait', .. }
					if (isUndefined(this.preferences.flavor_tags[flavorId][flavorValue])) {
						this.invalidate('preferences.flavor_tags.' + flavorId + '.' + flavorValue, 'Must be provided when providing preferences.flavor_tags.' + flavorId + '.');
					}
				});
			} else {
				this.invalidate('preferences.flavor_tags.' + flavorId, 'Must be provided when providing preferences.flavor_tags.');
			}
		});
	}

	if (this.preferences && this.preferences.notify_release_moderation_status) {
		if (!isBoolean(this.preferences.notify_release_moderation_status)) {
			this.invalidate('preferences.notify_release_moderation_status', 'Must be a boolean.');
		}
	}
	if (this.preferences && this.preferences.notify_backglass_moderation_status) {
		if (!isBoolean(this.preferences.notify_backglass_moderation_status)) {
			this.invalidate('preferences.notify_backglass_moderation_status', 'Must be a boolean.');
		}
	}

	// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
	if (this.channel_config && this.channel_config.subscribed_releases) {
		if (!isArray(this.channel_config.subscribed_releases)) {
			this.invalidate('channel_config.subscribed_releases', 'Must be an array of release IDs.');
			return true;
		}
		const Release = mongoose.model('Release');
		for (let i = 0; i < this.channel_config.subscribed_releases.length; i++) {
			const releaseId = this.channel_config.subscribed_releases[i];
			let rls = await Release.findOne({ id: releaseId }).exec();
			if (!rls) {
				this.invalidate('channel_config.subscribed_releases.' + i, 'Release with ID "' + releaseId + '" does not exist.');
			}
			i++;
		}
	}
	return null;


}, null);

UserSchema.path('password_hash').validate(function () {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this._password && isString(this._password) && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);

UserSchema.path('_plan').validate(function (plan: string) {
	return config.vpdb.quota.plans.map(p => p.id).includes(plan);
}, 'Plan must be one of: [' + config.vpdb.quota.plans.map(p => p.id).join(',') + ']');


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Authenticate - check if the passwords are the same
 * @param {string} plainText Plaintext password
 * @return {boolean} True if match, false otherwise.
 */
UserSchema.methods.authenticate = function (plainText: string): boolean {
	return this.hashPassword(plainText) === this.password_hash;
};

/**
 * Creates a random salt
 * @return {string} Random salt
 */
UserSchema.methods.makeSalt = function (): string {
	return Math.round((new Date().valueOf() * Math.random())) + '';
};

/**
 * Hashes a password with previously set salt.
 * @param {string} password Plain text password
 * @return {string} Hex-encoded hash
 */
UserSchema.methods.hashPassword = function (password: string): string {
	if (!password) {
		return '';
	}
	if (!this.password_salt) {
		return '';
	}
	return createHmac('sha1', this.password_salt).update(password).digest('hex');
};

/**
 * Checks if password has been set.
 * @return {boolean}
 */
UserSchema.methods.passwordSet = function (): boolean {
	return this.password_salt && this.password_hash;
};

/**
 * Checks if the user has at least one of the given roles
 * @param {string | string[]} role Roles to check
 * @return {boolean} True if at least one role matches, false otherwise.
 */
UserSchema.methods.hasRole = function (role: string | string[]): boolean {
	if (isArray(role)) {
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
// TRIGGERS
//-----------------------------------------------------------------------------
UserSchema.post('remove', async function (obj: User) {
	const acl = require('../common/acl');
	await server.models().LogUser.remove({ _user: obj._id });
	await server.models().Token.remove({ _created_by: obj._id });
	await acl.removeUserRoles(obj.id, obj.roles);
});

export var schema: Schema = UserSchema;
