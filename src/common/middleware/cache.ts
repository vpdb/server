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

import { keys, values } from 'lodash';
import chalk from 'chalk';

import { Context } from '../types/context';
import { logger } from '../logger';
import { ApiError, ApiValidationError } from '../api.error';
import { state } from '../../state';

/**
 * Gracefully handles errors.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaRedisCache() {

	return async function handleRequest(ctx: Context, next: () => Promise<any>) {

		// if not a GET or HEAD operation, abort.

		// if blacklisted resource, abort.

		const hash = ctx.request.path;
		const field = (ctx.state.user ? ctx.state.user.id : 'anon') + ':' + getQueryKey(ctx);
		const hit = await state.redis.hgetAsync(hash, field);
		if (hit) {
			logger.debug('[Cache] Got a hit!');
			const response = JSON.parse(hit) as CacheResponse;
			ctx.status = response.status;
			//ctx.response.headers = response.headers;
			ctx.response.body = response.body;
			return;
		}

		await next();

		const response:CacheResponse = {
			status: ctx.status,
			headers: ctx.headers,
			body: ctx.body
		};
		logger.debug('[Cache] No hit, saving.');
		await state.redis.hsetAsync(hash, field, JSON.stringify(response));
	}
}

function getQueryKey(ctx: Context) {
	return keys(ctx.query).sort().map(key => key + '=' + ctx.query[key]).join('&');
}

interface CacheResponse {
	status: number;
	headers: {[key:string]: string};
	body: any;
}