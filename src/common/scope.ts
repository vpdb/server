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

import { isArray } from 'lodash';

/**
 * Scopes control access of a given type of token. While permissions control
 * access to resources for a given user, scopes further narrow it down depending
 * on the type of authentication.
 */
export enum Scope {

	/**
	 * Previous "access" scope. Can do nearly everything.
	 *
	 * JWT tokens have this scope but also long-term tokens used in third-party
	 * applications such as VPDB Agent.
	 * @type {string}
	 */
	ALL = 'all',

	/**
	 * Used for autologin. Can be used to obtain a JWT (which has a "all" scope).
	 *
	 * This is used for browser auto-login so we don't have to store the plain
	 * text password on the user's machine.
	 * @type {string}
	 */
	LOGIN = 'login',

	/**
	 * Rate, star, comment, basically anything visible on the site.
	 * @type {string}
	 */
	COMMUNITY = 'community',

	/**
	 * Resources that are not personal but third-party application related.
	 *
	 * @type {string}
	 */
	SERVICE = 'service',

	/**
	 * All kind of uploads
	 * TODO implement and test
	 * @type {string}
	 */
	CREATE = 'create',

	/**
	 * Download access.
	 * @type {string}
	 */
	STORAGE = 'storage',

}

export class ScopeHelper {

	/**
	 * Defines which scopes a token type is allowed to have *at creation*.
	 * @private
	 */
	private _scopes: { personal: Scope[], provider: Scope[] } = {
		personal: [Scope.ALL, Scope.LOGIN, Scope.COMMUNITY, Scope.CREATE, Scope.STORAGE],
		provider: [Scope.COMMUNITY, Scope.CREATE, Scope.STORAGE, Scope.SERVICE],
	};

	/**
	 * Returns all scopes that are valid for a given token type at token
	 * creation.
	 *
	 * @param {"personal"|"provider"} type Token type
	 * @return {string[]} Valid scopes
	 */
	public getScopes(type: 'personal' | 'provider'): Scope[] {
		return this._scopes[type];
	}

	/**
	 * Checks if given scopes contain a scope.
	 *
	 * @param {string[]|null} scopes Scopes to check
	 * @param {string} scope Scope
	 * @return {boolean} True if found, false otherwise.
	 */
	public has(scopes: Scope[] | string[] | null, scope: Scope | string): boolean {
		return scopes && (scopes as string[]).includes(scope as string);
	}

	/**
	 * Makes sure that at least one scope is valid. Basically as soon as one
	 * of the given scopes is in the valid scopes, return trie.
	 *
	 * @param {string[]|"personal"|"provider"} [validScopes] If string given, match against valid scopes of given type. Otherwise match against given scopes.
	 * @param {string[]} scopesToValidate Scopes to check
	 * @return {boolean} True if all scopes are valid
	 */
	public isValid(validScopes: string[] | 'personal' | 'provider' | null, scopesToValidate: Scope[] | string[]): boolean {
		if (validScopes === null) {
			return true;
		}
		const scopes: Scope[] = isArray(validScopes) ? validScopes as Scope[] : this._scopes[validScopes];
		for (let i = 0; i < scopesToValidate.length; i++) {
			if (this.has(scopes, scopesToValidate[i])) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Checks if the given scopes are identical.
	 *
	 * @param {string[]} validScopes
	 * @param {string[]} scopes
	 * @return {boolean} True if identical, false otherwise.
	 */
	public isIdentical(validScopes: Scope[] | string[], scopes: Scope[] | string[]) {
		if (scopes.length !== validScopes.length) {
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

export const scope = new ScopeHelper();
