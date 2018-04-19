const Router = require('koa-router');
const { difference, keys } = require('lodash');
const ApiError = require('./api.error');

const logger = require('./logger');
const config = require('./settings').current;

class Api {

	/**
	 * The API call was successful.
	 *
	 * @param {Application/Context} ctx Koa context
	 * @param {object|null} body Response body or null if no response body to send.
	 * @param {number} [status=200] HTTP status code
	 * @returns {boolean}
	 */
	success(ctx, body, status) {
		status = status || 200;

		ctx.status = status;
		if (body) {
			ctx.body = body;
		}
		return true;
	}

	anon(handler) {
		return async ctx => {
			await this._handleRequest(ctx, handler);
		};
	}

	auth(handler, resource, permission, scopes) {
		return async ctx => {
			await this._handleRequest(ctx, handler);
		};
	}

	checkReadOnlyFields(newObj, oldObj, allowedFields) {
		const errors = [];
		difference(keys(newObj), allowedFields).forEach(field => {
			let newVal, oldVal;

			// for dates we want to compare the time stamp
			if (oldObj[field] instanceof Date) {
				newVal = newObj[field] ? new Date(newObj[field]).getTime() : undefined;
				oldVal = oldObj[field] ? new Date(oldObj[field]).getTime() : undefined;

			// for objects, serialize first.
			} else if (_.isObject(oldObj[field])) {
				newVal = newObj[field] ? JSON.stringify(newObj[field]) : undefined;
				oldVal = oldObj[field] ? JSON.stringify(_.pick(oldObj[field], _.keys(newObj[field] || {}))) : undefined;

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
	searchQuery(query) {
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
	 *
	 * @return {Router}
	 */
	apiRouter() {
		if (config.vpdb.api.pathname) {
			return new Router({ prefix: config.vpdb.api.pathname });
		} else {
			return new Router();
		}
	}

	async _handleRequest(ctx, handle) {
		try {
			const result = await handle(ctx);
			if (result !== true) {
				return this._handleError(ctx, new ApiError('Must return success() in API controller.').status(500));
			}
		} catch (err) {
			this._handleError(ctx, err);
		}
	}

	_handleError(ctx, err) {
		let message;
		const status = err.statusCode || 500;

		if (status === 500) {
			logger.error(err);
		}

		if (!err.status) {
			message = 'Internal error.';
		} else {
			message = err.message || 'Internal error.';
		}
		ctx.status = status;
		ctx.body = { error: message };
	}
}

module.exports = Api;