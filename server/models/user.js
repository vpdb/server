"use strict";

var _ = require('underscore');
var crypto = require('crypto');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

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
	roles:           [ String ],
	plan:            { type: String, required: false },
	provider:        { type: String, required: true },
	password_hash:   { type: String },
	password_salt:   { type: String },
	thumb:           { type: String },
	created_at:      { type: Date, required: true },
	is_active:       { type: Boolean, required: true, default: true }
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
	reduced: [ 'id', 'name', 'username', 'thumb', 'gravatar_id'],               // "member" search result
	simple: [ 'email', 'is_active', 'roles', 'plan', 'created_at', 'github' ]   // "admin" lists & profile
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
UserSchema.virtual('password')
	.set(function(password) {
		this._password = password;
		this.password_salt = this.makeSalt();
		this.password_hash = this.encryptPassword(password);
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
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider !== 'local') {
		return true;
	}
	return validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('email').validate(function(email) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider !== 'local') {
		return true;
	}
	return validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('username').validate(function(username) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider !== 'local') {
		return true;
	}
	if (!validator.matches(username, /^[a-z0-9\._]+$/i)) {
		this.invalidate('username', 'Username must only contain alpha-numeric characters including dot and underscore.');
	}
	if (!validator.isLength(username, 3, 30)) {
		this.invalidate('username', 'Length of username must be between 3 and 30 characters.');
	}
}, null);

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
	if (this.isNew && this._password && !validator.isLength(this._password, 6)) {
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
	return this.encryptPassword(plainText) === this.password_hash;
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
UserSchema.methods.encryptPassword = function(password) {
	if (!password) {
		return '';
	}
	return crypto.createHmac('sha1', this.password_salt).update(password).digest('hex');
};

UserSchema.methods.toReduced = function() {
	return _.pick(this.toObject(), apiFields.reduced);
};

UserSchema.methods.toSimple = function() {
	var user = _.pick(this.toObject(), apiFields.reduced.concat(apiFields.simple));
	if (!_.isEmpty(user.github)) {
		user.github = _.pick(user.github, 'id', 'login', 'email', 'avatar_url', 'html_url');
	}
	return user;
};

UserSchema.methods.toDetailed = function() {
	var user = this.toObject();
	if (!_.isEmpty(user.github)) {
		user.github = _.pick(user.github, 'id', 'login', 'email', 'avatar_url', 'html_url');
	}
	return user;
};


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

UserSchema.statics.createUser = function(userObj, done) {
	var User = mongoose.model('User');
	var user = new User(_.extend(userObj, {
		created_at: new Date()
	}));

	user.validate(function(err) {
		if (err) {
			return done(null, null, err);
		}
		User.count(function(err, count) {
			if (err) {
				logger.error('[model|user] Error counting users: %s', err, {});
				return done(err);
			}

			user.roles = count ? [ 'member' ] : [ 'root' ];
			user.plan = count ? config.vpdb.quota.defaultPlan : 'unlimited';

			user.save(function(err) {
				if (err) {
					logger.error('[model|user] Error saving user <%s>: %s', user.email, err, {});
					return done(err);
				}
				require('../acl').addUserRoles(user.email, user.roles, function(err) {
					if (err) {
						logger.error('[model|user] Error updating ACLs for <%s>: %s', user.email, err, {});
						return done(err);
					}
					logger.info('[model|user] %s <%s> successfully created.', count ? 'User' : 'Root user', user.email);
					done(null, user);
				});
			});
		});
	});
};


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
UserSchema.set('toObject', { virtuals: true });
if (!UserSchema.options.toObject) {
	UserSchema.options.toObject = {};
}
UserSchema.options.toObject.transform = function(doc, user) {
	delete user._id;
	delete user.__v;
	delete user.password_hash;
	delete user.password_salt;
	delete user.password;
};


mongoose.model('User', UserSchema);
logger.info('[model] Model "user" registered.');