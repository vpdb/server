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

import Router = require('koa-router');
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { GameRequestApi } from './game.request.api';

export class GameRequestApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new GameRequestApi();
		this.router = api.apiRouter();

		this.router.post('/v1/game_requests', api.auth(api.create.bind(api), 'game_requests', 'add', [Scope.ALL, Scope.COMMUNITY]));
		this.router.get('/v1/game_requests', api.auth(api.list.bind(api), 'game_requests', 'list', [Scope.ALL]));
		this.router.patch('/v1/game_requests/:id', api.auth(api.update.bind(api), 'game_requests', 'update', [Scope.ALL, Scope.COMMUNITY]));
		this.router.delete('/v1/game_requests/:id', api.auth(api.del.bind(api), 'game_requests', 'delete-own', [Scope.ALL, Scope.COMMUNITY]));
	}

	public getRouter(): Router {
		return this.router;
	}
}
