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

import Router = require('koa-router');
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { ReleaseVersionApi } from '../releases/version/release.version.api';
import { StarApi } from '../stars/star.api';
import { BackglassApi } from './backglass.api';
import { BackglassVersionApi } from './version/backglass.version.api';

export class BackglassApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new BackglassApi();
		this.router = api.apiRouter();

		this.router.get('/v1/backglasses',       api.list.bind(api));
		this.router.post('/v1/backglasses',       api.auth(api.create.bind(api), 'backglasses', 'add', [ Scope.ALL, Scope.CREATE ]));
		this.router.get('/v1/backglasses/:id',   api.view.bind(api));
		this.router.patch('/v1/backglasses/:id',  api.auth(api.update.bind(api), 'backglasses', 'update-own', [ Scope.ALL, Scope.CREATE ]));
		this.router.delete('/v1/backglasses/:id', api.auth(api.del.bind(api), 'backglasses', 'delete-own', [ Scope.ALL, Scope.CREATE ]));

		const versionApi = new BackglassVersionApi();
		this.router.post('/v1/backglasses/:id/versions',           versionApi.auth(versionApi.addVersion.bind(api), 'backglasses', 'add', [Scope.ALL, Scope.CREATE]));
		//this.router.patch('/v1/backglasses/:id/versions/:version', versionApi.auth(versionApi.updateVersion.bind(api), 'backglasses', 'update-own', [Scope.ALL, Scope.CREATE]));

		const starApi = new StarApi();
		this.router.post('/v1/backglasses/:id/star',   api.auth(starApi.star('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.delete('/v1/backglasses/:id/star', api.auth(starApi.unstar('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.get('/v1/backglasses/:id/star',    api.auth(starApi.get('backglass').bind(starApi), 'backglasses', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

		this.router.post('/v1/backglasses/:id/moderate', api.auth(api.moderate.bind(api), 'backglasses', 'moderate', [ Scope.ALL ]));

	}
	public getRouter(): Router {
		return this.router;
	}
}
