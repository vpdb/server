var _ = require('underscore');
var crypto = require('crypto');
var mongoose = require('mongoose');
var validator = require('validator');

var config = require('../modules/settings').current;
var Schema = mongoose.Schema;

/**
 * User Schema
 */
var fields = {
	name: String,
	email: { type: String, lowercase: true, unique: true },
	username: String,
	thumb: String,
	provider: { type: String, required: true },
	passwordHash: { type: String },
	salt: { type: String },
	active: { type: Boolean, default: true, required: true }
};
if (config.vpdb.passport.github.enabled) {
	fields['github'] = {};
}
_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
	if (ipbConfig.enabled) {
		fields[ipbConfig.id] = {};
	}
});
var UserSchema = new Schema(fields);

/**
 * Virtuals
 */
UserSchema.virtual('password')
	.set(function(password) {
		this._password = password;
		this.salt = this.makeSalt();
		this.passwordHash = this.encryptPassword(password);
	})
	.get(function() {
		return this._password
	});

/**
 * Validations
 */
UserSchema.path('name').validate(function(name) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.provider != 'local') {
		return true;
	}
	return name.length;
}, 'Name cannot be blank');

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
	return username.length;
}, 'Username cannot be blank');

UserSchema.path('provider').validate(function(provider) {

	// validate presence of password. can't do that in the password validator
	// below because it's not run when there's no value (and it can be null,
	// if auth strategy is not local. so do it here, invalidate password if
	// necessary but return true so provider passes.
	if (this.isNew && provider == 'local') {
		if (!this._password) {
			this.invalidate('password', 'required');
			return true;
		}
	}
}, null);

UserSchema.path('passwordHash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this.isNew && this._password && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'must be at least 6 characters.');
	}
}, null);


/**
 * Methods
 */
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
		return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
	}
};

mongoose.model('User', UserSchema);
