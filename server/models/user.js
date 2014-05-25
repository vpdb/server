var _ = require('underscore');
var crypto = require('crypto');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var config = require('../modules/settings').current;
var Schema = mongoose.Schema;

// schema
var fields = {
	name:         { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering
	username:     { type: String, index: true, unique: true },
	email:        { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	roles:        [ String ],
	provider:     { type: String, required: true },
	passwordHash: { type: String },
	passwordSalt: { type: String },
	thumb:        { type: String },
	active:       { type: Boolean, required: true, default: true }
};

// provider data fields
if (config.vpdb.passport.github.enabled) {
	fields['github'] = {};
}
_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
	if (ipbConfig.enabled) {
		fields[ipbConfig.id] = {};
	}
});
var UserSchema = new Schema(fields);
UserSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
UserSchema.index({ name: 'text', username: 'text', email: 'text' });

// virtuals
UserSchema.virtual('password')
	.set(function(password) {
		this._password = password;
		this.passwordSalt = this.makeSalt();
		this.passwordHash = this.encryptPassword(password);
	})
	.get(function() {
		return this._password
	});

// middleware
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

// validations
UserSchema.path('name').validate(function(name) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider != 'local') {
		return true;
	}
	return validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('email').validate(function(email) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider != 'local') {
		return true;
	}
	return validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('username').validate(function(username) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider != 'local') {
		return true;
	}
	if (!validator.isAlphanumeric(username)) {
		this.invalidate('username', 'Username must only contain alpha-numeric characters.');
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
	if (this.isNew && provider == 'local') {
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

UserSchema.path('passwordHash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this.isNew && this._password && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);


// methods
UserSchema.methods = {

	/**
	 * Authenticate - check if the passwords are the same
	 *
	 * @param {String} plainText
	 * @return {Boolean}
	 * @api public
	 */
	authenticate: function(plainText) {
		return this.encryptPassword(plainText) === this.passwordHash;
	},

	/**
	 * Make salt
	 *
	 * @return {String}
	 * @api public
	 */
	makeSalt: function() {
		return Math.round((new Date().valueOf() * Math.random())) + '';
	},

	/**
	 * Encrypt password
	 *
	 * @param {String} password
	 * @return {String}
	 * @api public
	 */
	encryptPassword: function(password) {
		if (!password) {
			return '';
		}
		return crypto.createHmac('sha1', this.passwordSalt).update(password).digest('hex');
	}
};

mongoose.model('User', UserSchema);
logger.info('[model] Model "user" registered.');