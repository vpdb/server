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

import { existsSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { isArray, isFunction, isObject, isUndefined, keys } from 'lodash';
import { VpdbConfig } from './types/config';
import { logger } from './logger';

const validators = require('./settings.validator');

export class Settings {

	public readonly current: VpdbConfig;
	private readonly filePath: string;

	constructor() {
		if (!process.env.APP_SETTINGS) {
			const e = new Error('Settings location not found. Please set the `APP_SETTINGS` environment variable to your configuration file and retry.');
			logger.error(e.stack);
			throw e;
		}
		const filePath = isAbsolute(process.env.APP_SETTINGS) ? process.env.APP_SETTINGS : resolve(process.cwd(), process.env.APP_SETTINGS);

		/* istanbul ignore next */
		if (!existsSync(filePath)) {
			throw new Error('Cannot find settings at "' + filePath + '". Copy src/config/settings-dist.js to server/config/settings.js or point `APP_SETTINGS` environment variable to correct path (CWD = ' + process.cwd() + ').');
		}
		this.filePath = filePath;
		this.current = require(this.filePath);
	}

	/**
	 * Checks that all settings are available and runs validation on each.
	 *
	 * @return {boolean} true if passes, false otherwise.
	 */
	validate() {
		logger.info('[settings] Validating settings at %s', this.filePath);
		return this._validate(validators, this.current, '');
	}

	/**
	 * Recursively validates the settings object.
	 *
	 * @param validation
	 * @param setting
	 * @param path
	 * @returns {boolean}
	 * @private
	 */
	_validate(validation: { [key: string]: any }, setting: { [key: string]: any }, path: string) {
		let success = true;
		let validationError, p, i, j;
		for (let s of keys(validation)) {
			p = (path + '.' + s).substr(1);

			// validation function
			if (isFunction(validation[s])) {
				if (isUndefined(setting[s]) && setting.enabled !== false) {
					logger.error('[settings] %s [KO]: Setting is missing.', p);
					success = false;
				} else {
					validationError = validation[s](setting[s], setting, settings);
					if (!validationError) {
						logger.info('[settings] %s [OK]', p);
					} else {
						if (isArray(validationError)) {
							for (j = 0; j < validationError.length; j++) {
								this._logError(p, validationError[j], setting[s]);
							}
						} else {
							this._logError(p, validationError, setting[s]);
						}
						success = false;
					}
				}
			}

			// array
			else if (validation[s].__array) {
				if (!isArray(setting[s])) {
					logger.error('[settings] %s [KO]: Setting must be an array.', p);
					success = false;
				} else {
					for (i = 0; i < setting[s].length; i++) {
						if (!this._validate(validation[s], setting[s][i], path + '.' + s + '[' + i + ']')) {
							//logger.error('[settings] %s failed', path);
							success = false;
						}
					}
				}
			}

			// object
			else if (validation[s] && isObject(validation[s])) {

				if (isUndefined(setting[s])) {
					logger.error('[settings] %s [KO]: Setting block is missing.', p);
					success = false;

				} else if (!this._validate(validation[s], setting[s], path + '.' + s)) {
					//logger.error('[settings] %s failed', path);
					success = false;
				}
			}

		}
		if (success && !path) {
			logger.info('[settings] Congrats, your settings look splendid!');
		}
		return success;
	};

	_logError(p: string, error: { path: string, message: string, setting?: string }, setting: object | string) {
		setting = !isUndefined(error.setting) ? error.setting : setting;
		let s = isObject(setting) ? JSON.stringify(setting) : setting;
		if (isObject(error)) {
			logger.error('[settings] %s.%s [KO]: %s (%s).', p, error.path, error.message, s);
		} else {
			logger.error('[settings] %s [KO]: %s (%s).', p, error, s);
		}
	};

	/**
	 * Returns the API URL containing the host only.
	 * @returns {string} API URL
	 */
	apiHost() {
		return this.current.vpdb.api.protocol + '://' +
			this.current.vpdb.api.hostname +
			(this.current.vpdb.api.port === 80 || this.current.vpdb.api.port === 443 ? '' : ':' + this.current.vpdb.api.port);
	};

	/**
	 * Returns the internal path of an API resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	apiPath(path = '') {
		return (this.current.vpdb.api.prefix || '') + this.current.vpdb.api.pathname + (path || '');
	}

	/**
	 * Returns the external URL of the API
	 * @returns {string} External URL
	 */
	apiUri() {
		return this.apiHost() + this.current.vpdb.api.pathname;
	};

	/**
	 * Returns the external URL of a public storage resource
	 * @param {string} [path] Path of the resource
	 * @returns {string} External URL
	 */
	storagePublicUri(path = '') {
		return this.storageUri(this.current.vpdb.storage.public.api.pathname + (path || ''), 'public');
	};

	/**
	 * Returns the internal path of a public storage resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	storagePublicPath(path = '') {
		return (this.current.vpdb.storage.public.api.prefix || '') + this.current.vpdb.storage.public.api.pathname + (path || '');
	}

	/**
	 * Returns the external URL of a protected storage resource
	 * @param {string} [path] Path of the resource
	 * @returns {string} External URL
	 */
	storageProtectedUri(path = '') {
		return this.storageUri(this.current.vpdb.storage.protected.api.pathname + (path || ''), 'protected');
	}

	/**
	 * Returns the internal path of a protected storage resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	storageProtectedPath(path = '') {
		return (this.current.vpdb.storage.protected.api.prefix || '') + this.current.vpdb.storage.protected.api.pathname + (path || '');
	}

	/**
	 * Returns the web URL for a given path
	 * @param {string} [path] Path of the URL
	 * @returns {string}
	 */
	webUri(path = '') {
		return this.current.vpdb.webapp.protocol + '://' +
			this.current.vpdb.webapp.hostname +
			(this.current.vpdb.webapp.port === 80 || this.current.vpdb.webapp.port === 443 ? '' : ':' + this.current.vpdb.webapp.port) +
			(path || '');
	}

	/**
	 * Returns the external URL of a storage resource
	 * @param {string} path Path of the resource
	 * @param {string} visibility Either "public" or "protected", depending which API is demanded
	 * @returns {string} Full URL
	 */
	storageUri(path: string, visibility: 'public' | 'protected') {
		let api = this.current.vpdb.storage[visibility].api;
		return api.protocol + '://' + api.hostname + (api.port === 80 || api.port === 443 ? '' : ':' + api.port) + (path || '');
	}

	/**
	 * Determines the API based of the internal path.
	 * @param internalPath
	 * @returns {{protocol: string, hostname: string, port: number, pathname: string, prefix: string }|null} API or null if no match.
	 */
	getApi(internalPath: string = null) {
		if (!internalPath) {
			return null;
		}
		let apis = [this.current.vpdb.storage.protected.api, this.current.vpdb.storage.public.api, this.current.vpdb.api];
		for (let i = 0; i < apis.length; i++) {
			let api = apis[i];
			let pathPrefix = (api.prefix || '') + api.pathname;
			if (pathPrefix === internalPath.substr(0, pathPrefix.length)) {
				return api;
			}
		}
		return null;
	}

	/**
	 * Converts an internal URL to an external URL
	 * @param internalPath
	 * @returns {string} External URL if an API could be matched, otherwise same string as given.
	 */
	intToExt(internalPath: string) {
		let api = this.getApi(internalPath);
		if (!api || !api.prefix) {
			return internalPath;
		}
		return internalPath.substr(api.prefix.length);
	}
}

export const settings = new Settings();
export const config = settings.current;