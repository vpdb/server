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

import { Context } from '../typings/context';
import { config } from '../settings';

/**
 * Makes sure that content headers are included.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaRestHandler() {
	return async function handleRest(ctx: Context, next: () => Promise<any>) {

		const hasBody = ctx.method === 'POST' || ctx.method === 'PUT' || ctx.method === 'PATCH';
		const apiPrefix = (config.vpdb.api.prefix || '') + (config.vpdb.api.pathname || '');

		// don't care about content type if it's not the api
		if (ctx.path.substr(0, apiPrefix.length) !== apiPrefix) {
			return await next();
		}

		if (hasBody && !ctx.request.get('content-type')) {
			ctx.response.status = 415;
			ctx.response.body = { error: 'You need to set the "Content-Type" header.' };
			return;
		}

		if (hasBody && !~ctx.get('content-type').indexOf('application/json')) {
			ctx.response.status = 415;
			ctx.response.body = { error: 'Sorry, the API only talks JSON. Did you forget to set the "Content-Type" header correctly?' };
			return;
		}

		await next();
	}
}