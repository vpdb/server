/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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
import { isArray, isFunction, isObject, isUndefined, keys } from 'lodash';
import { isAbsolute, resolve } from 'path';
import winston from 'winston';

import { settingValidations } from './settings.validator';
import { VpdbConfig } from './typings/config';

export class Settings {

	public readonly current: VpdbConfig;
	private readonly filePath: string;
	private readonly logger = winston.createLogger({
		format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)),
		transports: [ new winston.transports.Console() ],
		level: 'silly',
	});

	constructor() {
		/* istanbul ignore if */
		if (!process.env.APP_SETTINGS) {
			const e = new Error('Settings location not found. Please set the `APP_SETTINGS` environment variable to your configuration file and retry.');
			this.logger.error(e.stack);
			throw e;
		}
		const filePath = isAbsolute(process.env.APP_SETTINGS) ? process.env.APP_SETTINGS : resolve(process.cwd(), process.env.APP_SETTINGS);

		/* istanbul ignore next */
		if (!existsSync(filePath)) {
			throw new Error('Cannot find settings at "' + filePath + '". Copy src/config/settings-dist.js to server/config/settings.js or point `APP_SETTINGS` environment variable to correct path (CWD = ' + process.cwd() + ').');
		}
		this.logger.info(`[Settings] Loading from ${filePath}`);
		this.filePath = filePath;
		this.current = require(this.filePath);
	}

	/**
	 * Checks that all settings are available and runs validation on each.
	 *
	 * @return {boolean} true if passes, false otherwise.
	 */
	public validate() {
		this.logger.info(`[Settings.validate] Validating settings at ${this.filePath}`);
		return this._validate(settingValidations, this.current, '');
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
	/* istanbul ignore next */
	public _validate(validation: { [key: string]: any }, setting: { [key: string]: any }, path: string) {
		let success = true;
		let validationError: Array<{ path: string, message: string, setting?: string }> | { path: string, message: string, setting?: string };
		let p: string;
		let i: number;
		let j: number;
		for (const s of keys(validation)) {
			p = (path + '.' + s).substr(1);

			// validation function
			if (isFunction(validation[s])) {
				if (isUndefined(setting[s]) && setting.enabled !== false) {
					this.logger.error(`[Settings.validate] ${p} [KO]: Setting is missing.`);
					success = false;
				} else {
					validationError = validation[s](setting[s], setting, this.current);
					if (!validationError) {
						this.logger.info(`[Settings.validate] ${p} [OK]`);
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
			} else if (validation[s].__array) {
				if (!isArray(setting[s])) {
					this.logger.error(`[Settings.validate] ${p} [KO]: Setting must be an array.`);
					success = false;
				} else {
					for (i = 0; i < setting[s].length; i++) {
						if (!this._validate(validation[s], setting[s][i], path + '.' + s + '[' + i + ']')) {
							//logger.error('[settings] %s failed', path);
							success = false;
						}
					}
				}
			} else if (validation[s] && isObject(validation[s])) {

				if (isUndefined(setting[s])) {
					this.logger.error(`[Settings.validate] ${p} [KO]: Setting block is missing.`);
					success = false;

				} else if (!this._validate(validation[s], setting[s], path + '.' + s)) {
					//logger.error('[Settings.validate] %s failed', path);
					success = false;
				}
			}

		}
		if (success && !path) {
			this.logger.info(`[Settings.validate] Congrats, your settings look splendid!`);
		}
		return success;
	}

	/* istanbul ignore next: Our test settings are correct! */
	public _logError(p: string, error: { path: string, message: string, setting?: string }, setting: object | string) {
		setting = !isUndefined(error.setting) ? error.setting : setting;
		const s = isObject(setting) ? JSON.stringify(setting) : setting;
		if (isObject(error)) {
			this.logger.error(`[Settings.validate] ${p}.${error.path} [KO]: ${error.message} (${s}).`);
		} else {
			this.logger.error(`[Settings.validate] ${p} [KO]: ${error} (${s}).`);
		}
	}

	/**
	 * Returns the API URL containing the host only.
	 * @returns {string} API URL
	 */
	public apiHost() {
		return this.current.vpdb.api.protocol + '://' +
			this.current.vpdb.api.hostname +
			(this.current.vpdb.api.port === 80 || this.current.vpdb.api.port === 443 ? '' : ':' + this.current.vpdb.api.port);
	}

	/**
	 * Returns the external path of an API resource
	 * @param {string} path Path of the resource
	 * @returns {string} External path
	 */
	public apiExternalPath(path = '') {
		return this.current.vpdb.api.pathname + (path || '');
	}

	/**
	 * Returns the internal path of an API resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	public apiInternalPath(path = '') {
		return (this.current.vpdb.api.prefix || '') + this.current.vpdb.api.pathname + (path || '');
	}

	/**
	 * Returns the internal URL of the API
	 * @returns {string} External URL
	 */
	public apiExternalUri(path = '') {
		return this.apiHost() + this.apiExternalPath(path);
	}

	/**
	 * Returns the external URL of a public storage resource
	 * @param {string} [path] Path of the resource
	 * @returns {string} External URL
	 */
	public storagePublicUri(path = '') {
		return this.storageUri(this.current.vpdb.storage.public.api.pathname + (path || ''), 'public');
	}

	/**
	 * Returns the internal path of a public storage resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	public storagePublicPath(path = '') {
		return (this.current.vpdb.storage.public.api.prefix || '') + this.current.vpdb.storage.public.api.pathname + (path || '');
	}

	/**
	 * Returns the external URL of a protected storage resource
	 * @param {string} [path] Path of the resource
	 * @returns {string} External URL
	 */
	public storageProtectedUri(path = '') {
		return this.storageUri(this.current.vpdb.storage.protected.api.pathname + (path || ''), 'protected');
	}

	/**
	 * Returns the internal path of a protected storage resource
	 * @param {string} path Path of the resource
	 * @returns {string} Internal path
	 */
	public storageProtectedPath(path = '') {
		return (this.current.vpdb.storage.protected.api.prefix || '') + this.current.vpdb.storage.protected.api.pathname + (path || '');
	}

	/**
	 * Returns the web URL for a given path
	 * @param {string} [path] Path of the URL
	 * @returns {string}
	 */
	public webUri(path = '') {
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
	public storageUri(path: string, visibility: 'public' | 'protected') {
		const api = this.current.vpdb.storage[visibility].api;
		return api.protocol + '://' + api.hostname + (api.port === 80 || api.port === 443 ? '' : ':' + api.port) + (path || '');
	}

	/**
	 * Determines the API based of the internal path.
	 * @param internalPath
	 * @returns {{protocol: string, hostname: string, port: number, pathname: string, prefix: string }|null} API or null if no match.
	 */
	public getApi(internalPath: string = null) {
		if (!internalPath) {
			return null;
		}
		const apis = [this.current.vpdb.storage.protected.api, this.current.vpdb.storage.public.api, this.current.vpdb.api];
		for (const api of apis) {
			const pathPrefix = (api.prefix || '') + api.pathname;
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
	public intToExt(internalPath: string) {
		const api = this.getApi(internalPath);
		if (!api || !api.prefix) {
			return internalPath;
		}
		return internalPath.substr(api.prefix.length);
	}
}

export const settings = new Settings();
export const config = settings.current;
