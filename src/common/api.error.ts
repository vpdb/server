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
import { compact, isEmpty } from 'lodash';
import { basename, dirname, sep } from 'path';
import { format as sprintf } from 'util';

import { logger } from './logger';
import { Context } from './typings/context';

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
	 * An additional, machine-parsable error code in the body.
	 */
	public errorCode: string;

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
	private logLevel: 'warn' | 'error';

	/**
	 * The message that is returned to the client as `{ error: message }`.
	 */
	private responseMessage: string;

	/**
	 * A list of validation errors.
	 *
	 * If set, status 422 is returned.
	 */
	private errors: ApiValidationError[];

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

	public code(code: string): ApiError {
		this.errorCode = code;
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
	public log(cause?: Error): ApiError {
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
		if (!this.message) {
			this.message = 'Validation failed.';
		}
		this.errors = this.errors || [];
		this.errors.push({ path, message, value });
		this.statusCode = 422;
		this.stripFields();
		return this;
	}

	/**
	 * Adds multiple validation errors and sets the status to 422.
	 * @param {ApiValidationError[]} errs
	 * @returns {ApiError}
	 */
	public validationErrors(errs: ApiValidationError[]) {
		if (!this.message) {
			this.message = 'Validation failed.';
		}
		this.errors = errs;
		this.statusCode = 422;
		this.stripFields();
		return this;
	}

	/**
	 * Sends the error to the HTTP client.
	 * @param {Context} ctx Koa context
	 */
	public respond(ctx: Context) {

		const body = this.getResponse();
		ctx.response.status = this.statusCode;
		ctx.response.body = body;
	}

	/**
	 * Logs the error with the current logger.
	 */
	public print(requestLog = '') {
		let cause = (this.cause ? '\n' + ApiError.colorStackTrace(this.cause) + '\n' : '');
		if (this.errors) {
			cause += this.errors
				.filter(error => !!error.reason)
				.map(error => '\n' + ApiError.colorStackTrace(error.reason) + '\n')
				.join('');
		}
		let responseLog = '';
		if (requestLog) {
			responseLog = '\n' + chalk.cyan(JSON.stringify(this.getResponse(), null, '  '));
		}
		if (this.statusCode === 500 || this.logLevel === 'error') {
			logger.error('\n\n' + ApiError.colorStackTrace(this) + cause + requestLog + '\n\n');

		} else if (cause || this.logLevel === 'warn') {
			// sometimes the message is the stack, if that's the case then print the real stack.
			if (this.message.match(/\n\s+at/)) {
				logger.warn('\n\n' + ApiError.colorStackTrace(this) + cause + (requestLog ? requestLog + '\n' : '') + responseLog);
			} else {
				logger.warn(chalk.yellowBright(this.message.trim()) + '\n' + cause + (requestLog ? requestLog + '\n' : '') + responseLog);
			}
		}
	}

	/**
	 * Returns if the trace of the error should be sent to the crash reporter.
	 * @returns {boolean}
	 */
	public sendError(): boolean {
		return this.statusCode === 500 || this.logLevel === 'error';
	}

	/**
	 * Returns the error response body.
	 */
	private getResponse() {
		// if the message contains a stack trace, replace.
		const message = this.message.match(/\n\s+at/) ? 'Internal error.' : this.message;
		const body: any = this.data || { error: this.responseMessage || message, code: this.errorCode || undefined };
		if (this.errors) {
			body.errors = this.errors.map(ApiError.mapValidationError);
		}
		return body;
	}

	/**
	 * Strips prefix off validation paths if set.
	 */
	private stripFields() {
		if (!this.fieldPrefix) {
			return;
		}
		const map = new Map();
		this.errors = compact(this.errors.map(error => {
			error.path = error.path.replace(this.fieldPrefix, '');
			const key = error.path + '|' + error.message + '|' + error.value;
			// eliminate dupes
			if (map.has(key)) {
				return null;
			}
			map.set(key, true);
			return error;
		}));
	}

	/* tslint:disable:member-ordering */
	/**
	 * Returns a colored stack trace of a given error.
	 *
	 * @param {Error} err Error to colorize
	 * @returns {string} Colorized stack trace
	 */
	public static colorStackTrace(err: Error) {
		if (!err.stack) {
			return '';
		}
		return err.stack.split('\n').map((line, index) => {
			if (index === 0) {
				return chalk.redBright(line);
			}
			let match = line.match(/(\s*)at\s+([^\s]+)\s*\(([^)]{2}[^:]+):(\d+):(\d+)\)/i);
			let lineMatch: { ident: string, method?: string, fileName: string, row: string, col: string };
			if (match) {
				lineMatch = { ident: match[1], method: match[2], fileName: match[3], row: match[4], col: match[5] };
			} else {
				match = line.match(/(\s*)at\s+(.*?):(\d+):(\d+)/i);
				if (match) {
					lineMatch = { ident: match[1], fileName: match[2], row: match[3], col: match[4] };
				}
			}
			if (line.indexOf('node_modules') > 0 || (lineMatch && /^internal\/|^events|^fs|^_stream_readable/i.test(lineMatch.fileName))) {
				return chalk.gray(line);
			} else {
				if (lineMatch && lineMatch.method) {
					return lineMatch.ident + chalk.gray('at ') + chalk.whiteBright(lineMatch.method) + ' (' +
						dirname(lineMatch.fileName) + sep + chalk.yellowBright(basename(lineMatch.fileName)) +
						':' + chalk.cyanBright(lineMatch.row) + ':' + chalk.cyan(lineMatch.col) + ')';
				} else if (lineMatch) {
					return lineMatch.ident + chalk.gray('at ') +
						dirname(lineMatch.fileName) + sep + chalk.yellowBright(basename(lineMatch.fileName)) +
						':' + chalk.cyanBright(lineMatch.row) + ':' + chalk.cyan(lineMatch.col);
				} else {
					return chalk.gray(line);
				}
			}
		}).join('\n');
	}

	/* tslint:disable:member-ordering */
	/**
	 * Maps the full validation error object to what we return in the API.
	 * @param error Validation error
	 */
	private static mapValidationError(error: any) {
		return {
			field: error.path,
			message: error.message,
			value: isEmpty(error.value) ? undefined : error.value,
			code: isEmpty(error.kind) || error.kind === 'user defined' ? undefined : error.kind,
		};
	}
}

export interface ApiValidationError {
	path: string;
	message: string;
	value?: any;
	kind?: string;
	reason?: Error;
}
