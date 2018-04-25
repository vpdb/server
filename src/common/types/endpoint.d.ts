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

import Application = require('koa');
import Router from 'koa-router';

/**
 * An API end point (or, more RESTful, a "resource") bundles all the
 * functionality implemented by each end point, notably:
 *
 *    - API routes
 *    - API controller
 *    - Database model
 *    - Entity type
 */
export interface EndPoint {

	/**
	 * The name (plural) of the end point.
	 */
	readonly name: string;

	/**
	 * The resource path prefixes for logging purposes.
	 */
	readonly paths: string[]

	/**
	 * Returns the router containing all the routes of the end point.
	 * @return {Router}
	 */
	getRouter(): Router;

	/**
	 * Registers the end point with the application.
	 * @param {Application} app Koa application
	 */
	register(app:Application): void;

}