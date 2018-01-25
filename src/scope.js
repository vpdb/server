const _ = require('lodash');

/**
 * Scopes control access of a given type of token. While permissions control
 * access to resources for a given user, scopes further narrow it down depending
 * on the type of authentication.
 */
class Scope {

	constructor() {

		/**
		 * Previous "access" scope. Can do nearly everything.
		 *
		 * JWT tokens have this scope but also long-term tokens used in third-party
		 * applications such as VPDB Agent.
		 */
		this.ALL = 'all';

		/**
		 * Used for autologin. Can be used to obtain a JWT (which has a "all" scope).
		 *
		 * This is used for browser auto-login so we don't have to store the plain
		 * text password on the user's machine.
		 */
		this.LOGIN = 'login';

		/**
		 * Rate, star, comment, basically anything visible on the site.
		 */
		this.COMMUNITY = 'community';

		/**
		 * All kind of uploads
		 * TODO implement and test
		 */
		this.CREATE = 'create';

		/**
		 * Used for obtaining storage tokens.
		 * TODO implement and test
		 */
		this.STORAGE = 'storage';

		/**
		 * Defines which scopes a token type is allowed to have *at creation*.
		 * @private
		 */
		this._scopes = {
			personal:  [ this.ALL, this.LOGIN, this.COMMUNITY, this.CREATE, this.STORAGE ],
			application: [ this.COMMUNITY, this.CREATE, this.STORAGE ]
		};
	}

	/**
	 * Returns all scopes that are valid for a given token type at token
	 * creation.
	 *
	 * @param {"personal"|"application"} type Token type
	 * @return {string[]} Valid scopes
	 */
	getScopes(type) {
		return this._scopes[type];
	}

	/**
	 * Checks if given scopes contain a scope.
	 *
	 * @param {string[]|null} scopes Scopes to check
	 * @param {string} scope Scope
	 * @return {boolean} True if found, false otherwise.
	 */
	has(scopes, scope) {
		return scopes && scopes.includes(scope);
	}
	/**
	 * Makes sure that all given scopes are valid. Basically as soon as one
	 * of the given scopes is not in the valid scopes, returns false.
	 *
	 * @param {string[]|"personal"|"application"} [validScopes] If string given, match against valid scopes of given type. Otherwise match against given scopes.
	 * @param {string[]} scopesToValidate Scopes to check
	 * @return {boolean} True if all scopes are valid
	 */
	isValid(validScopes, scopesToValidate) {
		// fail if no scopes to validate given.
		if (!_.isArray(scopesToValidate)) {
			return false;
		}
		validScopes = _.isArray(validScopes) ? validScopes : this._scopes[validScopes];
		for (let i = 0; i < scopesToValidate.length; i++) {
			if (!this.has(validScopes, scopesToValidate[i])) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Checks if the given scopes are identical.
	 *
	 * @param {string[]} validScopes
	 * @param {string[]} scopes
	 * @return {boolean} True if identical, false otherwise.
	 */
	isIdentical(validScopes, scopes) {
		if (scopes.length !== validScopes.length){
			return false;
		}
		for (let i = 0; i < scopes.length; i++) {
			if (!this.has(validScopes, scopes[i])) {
				return false;
			}
		}
		return true;
	}
}

module.exports = new Scope();