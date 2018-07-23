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
import { assign, keys} from 'lodash';

import { IncomingMessage } from 'http';
import { ApiError, ApiValidationError } from '../api.error';
import { logger } from '../logger';
import { config } from '../settings';
import { Context } from '../typings/context';

// initialize raygun
let raygunClient: any = null;
if (config.vpdb.services.raygun.enabled) {
	logger.info('[koaErrorHandler] Setting up Raygun...');
	const raygun = require('raygun');
	raygunClient = new raygun.Client().init({ apiKey: config.vpdb.services.raygun.apiKey });
	raygunClient.setVersion(require('../../../package.json').version.substr(1));
}

/**
 * Gracefully handles errors.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaErrorHandler() {

	return async function handleError(ctx: Context, next: () => Promise<any>) {

		try {
			await next();

		} catch (err) {

			// thrown somewhere in app
			if (err.isApiError) {
				(err as ApiError).respond(ctx);

			// validation error from mongoose
			} else if (err.name === 'ValidationError') {
				new ApiError('Validation failed.').validationErrors(getValidationErrors(err)).warn().respond(ctx);

			// unexpected errors
			} else {
				ctx.response.status = 500;
				ctx.response.body = { error: 'Internal server error. Sorry about that, we will get a mail about this and fix it ASAP.' };
			}

			// log
			let sendError: boolean;
			if (err.isApiError) {
				(err as ApiError).print('\n\n' + chalk.magenta(requestLog(ctx)));
				sendError = (err as ApiError).sendError();

			} else if (err.name === 'ValidationError') {
				new ApiError('Validation failed.').validationErrors(getValidationErrors(err)).warn().print('\n\n' + chalk.magenta(requestLog(ctx)));
				sendError = false;

			} else {
				logger.error('\n\n' + ApiError.colorStackTrace(err) + '\n\n' + chalk.magenta(requestLog(ctx)) + '\n');
				sendError = true;
			}

			if (sendError) {
				reportError(ctx, err as Error);
			}
		}
	};
}

export function handleParseError(err: Error, ctx: Context) {
	ctx.throw('Parsing error: ' + err.message, 400);
}

function getValidationErrors(err: any): ApiValidationError[] {
	return keys(err.errors).map(path => {
		let p;
		if (err.trimFields) {
			p = path.replace(err.trimFields, '');
		} else {
			p = path;
		}
		return assign(err.errors[path], { path: p });
	});
}

function requestLog(ctx: Context) {
	let err = ctx.request.method + ' ' + ctx.request.path + '\n\n';
	err += keys(ctx.request.header).map(name => name + ': ' + ctx.request.get(name)).join('\n');
	if (ctx.request.rawBody) {
		err += '\n\n' + ctx.request.rawBody;
	}
	return err;
}

function reportError(ctx: Context, err: Error) {
	if (raygunClient) {
		reportRaygun(ctx, err);
	}
}

function reportRaygun(ctx: Context, err: Error) {
	if (ctx.state.user) {
		raygunClient.user = () => {
			return {
				identifier: ctx.state.user.name || ctx.state.user.username,
				email: ctx.state.user.email,
				fullName: ctx.state.user.username,
			};
		};
	} else {
		raygunClient.user = () => {
			return {};
		};
	}
	const customData = {};
	raygunClient.send(err, customData, (response: IncomingMessage) => {
		if (response.statusCode === 202) {
			logger.info('[koaErrorHandler] Report sent to Raygun.');
		} else {
			logger.error('[koaErrorHandler] Error sending report sent to Raygun (%s)', response.statusCode);
		}
	}, ctx.req, [ config.vpdb.name ]);
}
