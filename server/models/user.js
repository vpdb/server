/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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
var crypto = require('crypto');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');
var validator = require('validator');
var randomstring = require('randomstring');
var uniqueValidator = require('mongoose-unique-validator');

var error = require('../modules/error')('model', 'user');
var config = require('../modules/settings').current;
var Schema = mongoose.Schema;



//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:              { type: String, required: true, unique: true, 'default': shortId.generate },
	name:            { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering
	username:        { type: String, index: true, unique: true, sparse: true },
	email:           { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	email_status:    {
		code:        { type: String, enum: [ 'confirmed', 'pending' ], required: true },
		token:       { type: String },
		expires_at:  { type: Date },
		value:       { type: String }
	},
	roles:           { type: [ String ], required: true },
	plan:            { type: String, required: false },
	provider:        { type: String, required: true },
	password_hash:   { type: String },
	password_salt:   { type: String },
	thumb:           { type: String },
	location:        { type: String },
	created_at:      { type: Date, required: true },
	is_active:       { type: Boolean, required: true, default: false }
};
// provider data fields
if (config.vpdb.passport.github.enabled) {
	fields.github = {};
}
_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
	if (ipbConfig.enabled) {
		fields[ipbConfig.id] = {};
	}
});
var UserSchema = new Schema(fields);
UserSchema.index({ name: 'text', username: 'text', email: 'text' });
UserSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	reduced: [ 'id', 'name', 'username', 'thumb', 'gravatar_id', 'location' ],             // "member" search result
	simple: [ 'email', 'is_active', 'provider', 'roles', 'plan', 'created_at', 'github' ]  // "admin" lists & profile
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
		_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
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

UserSchema.path('username').validate(function(username) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.isNew && this.provider !== 'local') {
		return true;
	}
	if (!validator.matches(username, /^[a-z0-9\._]+$/i)) {
		this.invalidate('username', 'Username must only contain alpha-numeric characters including dot and underscore.');
	}
	if (!validator.isLength(username, 3, 30)) {
		this.invalidate('username', 'Length of username must be between 3 and 30 characters.');
	}
}, null);

UserSchema.path('location').validate(function(location) {
	return validator.isLength(location, 0, 100);
}, 'Location must not be longer than 100 characters.');

UserSchema.path('provider').validate(function(provider) {

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
		return true;
	}
}, null);

UserSchema.path('password_hash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this._password && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);


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
	var user = new User(_.extend(userObj, {
		created_at: new Date(),
		roles: [ 'member' ]
	}));

	if (confirmUserEmail) {
		user.email_status = {
			code: 'pending',
			token: randomstring.generate(16),
			expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
			value: userObj.email
		};
	} else {
		user.email_status = { code: 'confirmed' };
		user.is_active = true;
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
			user.plan = count ? config.vpdb.quota.defaultPlan : 'unlimited';

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
					logger.info('[model|user] %s <%s> successfully created with ID "%s".', count ? 'User' : 'Root user', user.email, user.id);
					done(null, user);
				});
			});
		});
	});
};
UserSchema.statics.toReduced = function(user) {
	var obj = user.toObject ? user.toObject() : user;
	return _.pick(obj, apiFields.reduced);
};

UserSchema.statics.toSimple = function(user) {
	var obj = user.toObject ? user.toObject() : user;
	user = _.pick(obj, apiFields.reduced.concat(apiFields.simple));
	if (!_.isEmpty(user.github)) {
		user.github = UserSchema.statics.normalizeProviderData('github', user.github);
	}
	return user;
};

UserSchema.statics.toDetailed = function(user) {
	user = user.toObject ? user.toObject() : user;
	if (!_.isEmpty(user.github)) {
		user.github = UserSchema.statics.normalizeProviderData('github', user.github);
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
	}
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
UserSchema.set('toObject', { virtuals: true });
UserSchema.options.toObject.transform = function(doc, user) {
	delete user._id;
	delete user.__v;
	delete user.password_hash;
	delete user.password_salt;
	delete user.password;
	delete user.email_status;
};


mongoose.model('User', UserSchema);
logger.info('[model] Schema "User" registered.');