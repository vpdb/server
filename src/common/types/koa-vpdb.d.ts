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

declare module "@koa/cors" {
	import * as Koa from 'koa';
	namespace cors {
		interface Options {
			origin?: string | ((ctx: Koa.Context) => boolean | string);
			exposeHeaders?: string[];
			maxAge?: number;
			credentials?: boolean;
			allowMethods?: string[];
			allowHeaders?: string[];
		}
	}
	function cors(options?: cors.Options): Koa.Middleware;
	export = cors;
}
