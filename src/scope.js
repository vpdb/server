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
		 * Used for autologin. Can be used to obtain a JWT (which has "all" scope).
		 *
		 * This is used for browser auto-login so we don't have to store the plain
		 * text password on the user's machine. The only thing it
		 */
		this.LOGIN = 'login';

		/**
		 * Rate, star, comment, basically anything visible on the site.
		 */
		this.COMMUNITY = 'community';

		/**
		 * All kind of uploads
		 */
		this.CREATE = 'create';

		/**
		 * Used for obtaining storage tokens.
		 */
		this.STORAGE = 'storage';

		this._scopes = [ this.ALL, this.LOGIN, this.COMMUNITY, this.CREATE, this.STORAGE ];
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
	 * Makes sure that all given scopes are valid
	 * @param {string[]} scopes Scopes to check
	 * @param {string[]|null} [validScopes] Valid scopes, all scopes when omitted
	 * @return {boolean} True if all scopes are valid
	 */
	isValid(scopes, validScopes) {
		if (!_.isArray(scopes)) {
			return true;
		}
		validScopes = validScopes || this._scopes;
		for (let i = 0; i < scopes.length; i++) {
			if (!this.has(validScopes, scopes[i])) {
				return false;
			}
		}
		return true;
	}

	isExclusive(scopes, validScopes) {
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