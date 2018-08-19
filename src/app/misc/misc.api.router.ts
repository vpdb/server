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

import * as Router from 'koa-router';
import { apiCache } from '../common/api.cache';
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { MiscApi } from './misc.api';

export class MiscApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new MiscApi();
		this.router = api.apiRouter();

		this.router.get('/v1/sitemap', api.sitemap.bind(api));
		this.router.get('/v1/ping',    api.ping.bind(api));
		this.router.get('/v1/plans',   api.plans.bind(api));
		this.router.get('/v1/roles',    api.auth(api.roles.bind(api), 'roles', 'list', [ Scope.ALL ]));
		this.router.get('/v1/ipdb/:id', api.auth(api.ipdbDetails.bind(api), 'ipdb', 'view', [ Scope.ALL ]));
		this.router.delete('/v1/cache', api.auth(api.invalidateCache.bind(api), 'cache', 'delete', [ Scope.ALL ]));

		if (process.env.ENABLE_KILL_SWITCH) {
			this.router.post('/v1/kill',     api.kill.bind(api));
		}
		this.router.get('index', '/v1', api.index.bind(api));
		this.router.redirect('/', 'index');

		apiCache.enable(this.router, '/v1/sitemap', { entities: [], listModels: ['game', 'release'] });
	}

	public getRouter(): Router {
		return this.router;
	}
}
