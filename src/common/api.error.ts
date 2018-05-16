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

import chalk from 'chalk';
import { format as sprintf } from 'util';
import { compact, isArray, isObject } from 'lodash';
import { logger } from './logger';
import { Context } from './types/context';
import { basename, dirname, sep } from 'path';

export class ApiError extends Error {

	/**
	 * Marks the error as API error so we don't need to deal with `instanceof`
	 * @type {boolean}
	 */
	public isApiError = true;

	/**
	 * HTTP status to return to the client. Default is 500.
	 * @type {number}
	 */
	public statusCode: number = 500;

	/**
	 * The body that should be returned to the client.
	 */
	public data: { [key: string]: any };

	/**
	 * If set, log to console.
	 *
	 * - `warn` will only log to console.
	 * - `error` will log to the console with a stack trace and the crash reporter.
	 *
	 * Independently of this value, if statusCode is 500, `error` is assumed.
	 */
	private logLevel: 'warn'|'error';

	/**
	 * The message that is returned to the client as `{ error: message }`.
	 */
	private responseMessage: string;

	/**
	 * A list of validation errors.
	 *
	 * If set, status 422 is returned.
	 */
	private errs: ApiValidationError[];

	/**
	 * If set, this prefix is stripped from the validation field values.
	 */
	private fieldPrefix: string;

	/**
	 * Error coming from elsewhere. Will be logged instead of parent.
	 */
	private cause: Error | undefined;

	/**
	 * Constructor.
	 * @param format Message
	 * @param param Message arguments to replaced
	 */
	constructor(format?: any, ...param: any[]) {
		super(sprintf.apply(null, arguments));
		this.logLevel = null; // don't log per default
	}

	/**
	 * Sets the HTTP status.
	 * @param {number} status HTTP status
	 * @returns {ApiError}
	 */
	public status(status: number): ApiError {
		this.statusCode = status;
		return this;
	}

	/**
	 * Don't return original message but this (original message gets logged).
	 *
	 * @param format Message
	 * @param param Parameters
	 * @return {ApiError}
	 */
	public display(format?: any, ...param: any[]): ApiError {
		this.responseMessage = sprintf.apply(null, arguments);
		return this;
	}

	/**
	 * Set response body
	 * @param {object} data
	 * @return {ApiError}
	 */
	public body(data: object): ApiError {
		this.data = data;
		return this;
	}

	/**
	 * Logs a warning to the console.
	 * @return {ApiError}
	 */
	public warn(): ApiError {
		this.logLevel = 'warn';
		return this;
	}

	/**
	 * Logs an error and a stack trace to the console. Also sends the
	 * error to the crash reporter.
	 * @return {ApiError}
	 */
	public log(cause?:Error): ApiError {
		this.logLevel = 'error';
		this.cause = cause;
		return this;
	}

	/**
	 * Adds a validation error and sets the status to 422.
	 * @param {string} path Path to the invalid field
	 * @param {string} message Error message
	 * @param {*} [value] Invalid value
	 * @returns {ApiError}
	 */
	public validationError(path: string, message: string, value?: any): ApiError {
		this.errs = this.errs || [];
		this.errs.push({ path: path, message: message, value: value });
		this.statusCode = 422;
		this.stripFields();
		return this;
	};

	/**
	 * Adds multiple validation errors and sets the status to 422.
	 * @param {ApiValidationError[]} errs
	 * @returns {ApiError}
	 */
	public validationErrors(errs: ApiValidationError[]) {
		this.errs = errs;
		this.statusCode = 422;
		this.stripFields();
		return this;
	}

	/**
	 * Sends the error to the HTTP client.
	 * @param {Context} ctx Koa context
	 */
	public respond(ctx:Context) {
		ctx.status = this.statusCode;
		ctx.body = this.data || { error: this.message };
	}

	/**
	 * Logs the error with the current logger.
	 */
	public print(requestLog = '') {
		if (this.statusCode === 500 || this.logLevel === 'error') {
			logger.error('\n\n' + ApiError.colorStackTrace(this) + (this.cause ? '\n' + ApiError.colorStackTrace(this.cause) + '\n' : '') + requestLog + '\n\n');

		} else if (this.logLevel === 'warn') {
			logger.warn(chalk.yellowBright(this.message.trim()));
		}
	}

	/**
	 * Returns if the trace of the error should be sent to the crash reporter.
	 * @returns {boolean}
	 */
	public sendError():boolean {
		return this.statusCode === 500 || this.logLevel === 'error';
	}

	/**
	 * Returns a colored stack trace of a given error.
	 *
	 * @param {Error} err Error to colorize
	 * @returns {string} Colorized stack trace
	 */
	public static colorStackTrace(err: Error) {
		return err.stack.split('\n').map((line, index) => {
			if (index === 0) {
				return chalk.redBright(line);
			}
			const match = line.match(/(\s*)at ([^\s]+)\s*\(([^)]{2}[^:]+):(\d+):(\d+)\)/i);
			if (line.indexOf('node_modules') > 0 || (match && /^internal\//i.test(match[3]))) {
				return chalk.gray(line);
			} else {
				if (match) {
					return match[1] + chalk.gray('at ') + chalk.whiteBright(match[2]) + ' (' +
						dirname(match[3]) + sep + chalk.yellowBright(basename(match[3])) +
						':' + chalk.cyanBright(match[4]) + ':' + chalk.cyan(match[5]) + ')';
				} else {
					return chalk.gray(line);
				}
			}
		}).join('\n');
	}

	/**
	 * Strips prefix off validation paths if set.
	 */
	private stripFields() {
		if (!this.fieldPrefix) {
			return;
		}
		if (isArray(this.errs)) {
			let map = new Map();
			this.errs = compact(this.errs.map(error => {
				error.path = error.path.replace(this.fieldPrefix, '');
				let key = error.path + '|' + error.message + '|' + error.value;
				// eliminate dupes
				if (map.has(key)) {
					return null;
				}
				map.set(key, true);
				return error;
			}));

		} else if (isObject(this.errs)) {
			throw new Error('Errs is an object and probably should not be.');
			// todo use https://github.com/lodash/lodash/issues/169 when merged
			// forEach(this.errs, (error, path) => {
			// 	const newPath = path.replace(this.fieldPrefix, '');
			// 	if (newPath !== path) {
			// 		this.errs[newPath] = error;
			// 		delete this.errs[path];
			// 	}
			// });
		}
	};
}

export interface ApiValidationError {
	path: string,
	message: string,
	value?: any
}