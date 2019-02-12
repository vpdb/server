/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import * as Router from 'koa-router';
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { BuildApi } from './build.api';

export class BuildApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new BuildApi();
		this.router = api.apiRouter();

		this.router.get('/v1/builds',       api.list.bind(api));
		this.router.post('/v1/builds',       api.auth(api.create.bind(api), 'builds', 'add', [ Scope.ALL, Scope.CREATE ]));
		this.router.get('/v1/builds/:id',   api.view.bind(api));
		this.router.patch('/v1/builds/:id',  api.auth(api.update.bind(api), 'builds', 'update', [ Scope.ALL, Scope.CREATE ]));
		this.router.delete('/v1/builds/:id', api.auth(api.del.bind(api), 'builds', 'delete-own', [ Scope.ALL, Scope.CREATE ]));
	}

	public getRouter(): Router {
		return this.router;
	}
}
