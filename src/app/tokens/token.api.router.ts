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
import { TokenApi } from './token.api';

export class TokenApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new TokenApi();
		this.router = api.apiRouter();

		this.router.post('/v1/tokens',      api.auth(api.create.bind(api), 'tokens', 'add', [ Scope.ALL ]));
		this.router.get('/v1/tokens',       api.auth(api.list.bind(api), 'tokens', 'list', [ Scope.ALL ], { enableAppTokens: true }));
		this.router.get('/v1/tokens/:id',  api.view.bind(api));
		this.router.del('/v1/tokens/:id',   api.auth(api.del.bind(api), 'tokens', 'delete-own', [ Scope.ALL ]));
		this.router.patch('/v1/tokens/:id', api.auth(api.update.bind(api), 'tokens', 'update-own', [ Scope.ALL ]));
	}

	public getRouter(): Router {
		return this.router;
	}
}
