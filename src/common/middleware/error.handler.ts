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

import { keys } from 'lodash';
import chalk from 'chalk';

import { Context } from '../types/context';
import { logger } from '../logger';
import { ApiError } from '../api.error';

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

			// handle client
			if (err.isApiError) {
				(err as ApiError).respond(ctx);

			} else {
				ctx.status = 500;
				ctx.body = { error: 'Internal server error. Sorry about that, we will get a mail about this and fix it ASAP.' };
			}

			// log
			let sendError:boolean;
			if (err.isApiError) {
				(err as ApiError).print('\n\n' + chalk.magenta(requestLog(ctx)));
				sendError = (err as ApiError).sendError();
			} else {
				logger.error('\n\n' + ApiError.colorStackTrace(err) + '\n\n' + chalk.magenta(requestLog(ctx)) + '\n');
				sendError = true;
			}

			if (sendError) {
				reportError(err as Error);
			}
		}
	}
}

function requestLog(ctx:Context) {
	let err = ctx.request.method + ' ' + ctx.request.path + '\n\n';
	err += keys(ctx.request.header).map(name => name + ': ' + ctx.request.get(name)).join('\n');
	if (ctx.request.rawBody) {
		err += '\n\n' + ctx.request.rawBody;
	}
	return err;
}


function reportError(err:Error) {
	// TODO: send to raygun
}