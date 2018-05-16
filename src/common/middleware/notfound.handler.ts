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

import { Context } from '../types/context';
import { ApiError } from '../api.error';

/**
 * Returns a 404 body.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koa404Handler() {
	return async function handle404(ctx: Context, next: () => Promise<any>) {
		await next();
		if (ctx.status === 404) {
			if (!ctx.request.path.includes('/v1')) {
				throw new ApiError('Resource not found. Maybe you forgot to use the /v1 prefix for the resouce?').status(404);
			}
			throw new ApiError('Resource not found.').status(404);
		}
	}
}