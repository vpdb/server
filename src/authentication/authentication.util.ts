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

import { parse } from 'url';
import { encode as jwtEncode } from 'jwt-simple';
import { User } from '../users/user';
import { config } from '../common/settings';

export class AuthenticationUtil {

	/**
	 * Creates a JSON Web Token for a given user and time.
	 *
	 * @param {User} user User to issue for
	 * @param {Date} now Current time
	 * @param {boolean} isRefreshToken If set, mark the token as refresh token (can't be used for creating login tokens)
	 * @returns {string} JSON Web Token for the API
	 */
	static generateApiToken(user: User, now: Date, isRefreshToken: boolean) {
		return jwtEncode({
			iss: user.id,
			iat: now,
			exp: new Date(now.getTime() + config.vpdb.apiTokenLifetime),
			irt: isRefreshToken,
			scp: [ 'all' ]
		}, config.vpdb.secret);
	}

	/**
	 * Creates a media token.
	 *
	 * Media tokens are only valid for a given path and HTTP method and time out
	 * much faster (default 1 minute).
	 *
	 * @param {User} user User to issue for
	 * @param {Date} now Current time
	 * @param {string} path Path the token will be valid for
	 * @returns {string} JSON Web Token for a storage item
	 */
	static generateStorageToken(user: User, now: Date, path: string): string {
		if (!path.startsWith('/')) {
			path = AuthenticationUtil.urlPath(path);
		}
		return jwtEncode({
			iss: user.id,
			iat: now,
			exp: new Date(now.getTime() + config.vpdb.storageTokenLifetime),
			path: path,
			scp: [ 'storage' ]
		}, config.vpdb.secret);
	}

	/**
	 * Normalizes the URL.
	 * @param {string} url URL to normalize
	 * @returns {string} Normalized URL
	 */
	private static urlPath(url: string): string {
		let u = parse(url);
		let q = u.search || '';
		let h = u.hash || '';
		return u.pathname + q + h;
	}
}


export interface Jwt {
	/**
	 * User ID
	 */
	iss: string;
	/**
	 * Scopes of the token
	 */
	scp: string[];
	/**
	 * Issue date and time
	 */
	iat: string;
	/**
	 * Expiration date and time
	 */
	exp: string;
	/**
	 * Is refresh token
	 */
	irt: boolean;
	/**
	 * Path of resource. If set, only valid for given path.
	 */
	path?: string;

}