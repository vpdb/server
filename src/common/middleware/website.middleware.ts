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

import send from 'koa-send';
import { resolve } from 'path';

import { settings } from '../settings';
import { Context } from '../typings/context';

/**
 * Makes sure that content headers are included.
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaWebsiteHandler(root: string, opts?: any) {
	opts = {...opts};
	opts.root = resolve(root);
	if (opts.index !== false) {
		opts.index = opts.index || 'index.html';
	}
	return async function handleWebsite(ctx: Context, next: () => Promise<any>) {
		try {
			await next();

		} catch (err) {
			if (ctx.method !== 'HEAD' && ctx.method !== 'GET') {
				throw err;
			}
			if (ctx.path.startsWith(settings.apiPath())) {
				throw err;
			}
			try {
				if (/\/$|\/[^.]+$/i.test(ctx.path)) {
					await send(ctx, '/', opts);
				} else {
					await send(ctx, ctx.path, opts);
				}

			} catch (e) {
				throw err;
			}
		}
	};
}
