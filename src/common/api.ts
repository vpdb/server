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

import { difference, keys, pick, isObject } from 'lodash';
import { Context } from './types/context';
import { logger } from './logger';
import { config } from './settings';
import { ApiError, ApiValidationError } from './api.error';
import Router from 'koa-router';


export class Api<T> {

	/**
	 * The API call was successful.
	 * @param {Application.Context} ctx Koa context
	 * @param {object|null} body Response body or null if no response body to send.
	 * @param {number} [status=200] HTTP status code
	 * @return {boolean}
	 */
	success(ctx: Context, body?: any, status?: number) {
		status = status || 200;

		ctx.status = status;
		ctx.body = body;
		return true;
	}

	anon(handler: (ctx: Context) => boolean) {
		return async (ctx: Context) => {
			await this._handleRequest(ctx, handler);
		};
	}

	auth(handler: (ctx: Context) => boolean, resource: string, permission: string, scopes: string[]) {
		return async (ctx: Context) => {
			await this._handleRequest(ctx, handler);
		};
	}

	checkReadOnlyFields(newObj: {[key:string]: any}, oldObj: {[key:string]: any}, allowedFields: string[]) {
		const errors:ApiValidationError[] = [];
		difference(keys(newObj), allowedFields).forEach(field => {
			let newVal, oldVal;

			// for dates we want to compare the time stamp
			if (oldObj[field] instanceof Date) {
				newVal = newObj[field] ? new Date(newObj[field]).getTime() : undefined;
				oldVal = oldObj[field] ? new Date(oldObj[field]).getTime() : undefined;

				// for objects, serialize first.
			} else if (isObject(oldObj[field])) {
				newVal = newObj[field] ? JSON.stringify(newObj[field]) : undefined;
				oldVal = oldObj[field] ? JSON.stringify(pick(oldObj[field], keys(newObj[field] || {}))) : undefined;

				// otherwise, take raw values.
			} else {
				newVal = newObj[field];
				oldVal = oldObj[field];
			}
			if (newVal && newVal !== oldVal) {
				errors.push({
					message: 'This field is read-only and cannot be changed.',
					path: field,
					value: newObj[field]
				});
			}
		});

		return errors.length ? errors : false;
	}

	/**
	 * Creates a MongoDb query out of a list of queries
	 * @param {object[]} query Search queries
	 * @returns {object}
	 */
	searchQuery(query: object[]) {
		if (query.length === 0) {
			return {};
		} else if (query.length === 1) {
			return query[0];
		} else {
			return { $and: query };
		}
	};

	/**
	 * Instantiates a new router with the API prefix.
	 * @return {Router}
	 */
	apiRouter() {
		if (config.vpdb.api.pathname) {
			return new Router({ prefix: config.vpdb.api.pathname });
		} else {
			return new Router();
		}
	}

	async _handleRequest(ctx: Context, handler: (ctx: Context) => boolean) {
		try {
			const result = await handler(ctx);
			if (result !== true) {
				//this._handleError(ctx, new ApiError('Must return success() in API controller.').status(500));
			}
		} catch (err) {
			this._handleError(ctx, err);
		}
	}

	_handleError(ctx: Context, err: ApiError) {
		let message;
		const statusCode = err.statusCode || 500;

		if (statusCode === 500) {
			logger.error(err);
		}

		if (!err.status) {
			message = 'Internal error.';
		} else {
			message = err.message || 'Internal error.';
		}
		ctx.status = statusCode;
		ctx.body = { error: message };
	}
}