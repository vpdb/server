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

import Router from 'koa-router';
import { EndPoint } from '../common/api.endpoint';

import Application = require('koa');
import { authenticationApiRouter } from './authentication.api.router';
import { authenticationStorageRouter } from './authentication.storage.router';

export class AuthenticationEndPoint extends EndPoint {

	public readonly name: string = 'Authentication API';

	constructor() {
		super();
	}

	public getRouter(): Router {
		return authenticationApiRouter;
	}

	public async register(app: Application): Promise<void> {
		// nothing to initialize
	}
}

export class AuthenticationStorageEndPoint extends EndPoint {

	public readonly name: string = 'Storage Authentication API';

	constructor() {
		super();
	}

	public getRouter(): Router {
		return authenticationStorageRouter;
	}

	public async register(app: Application): Promise<void> {
		// nothing to register
	}
}
