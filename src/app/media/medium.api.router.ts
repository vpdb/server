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
import { StarApi } from '../stars/star.api';
import { MediumApi } from './medium.api';

export class MediumApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new MediumApi();
		this.router = api.apiRouter();

		this.router.post('/v1/media',       api.auth(api.create.bind(api), 'media', 'add', [Scope.ALL, Scope.CREATE]));
		this.router.delete('/v1/media/:id', api.auth(api.del.bind(api), 'media', 'delete-own', [Scope.ALL, Scope.CREATE]));

		const starApi = new StarApi();
		this.router.post('/v1/media/:id/star',   starApi.auth(starApi.star('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.delete('/v1/media/:id/star', starApi.auth(starApi.unstar('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.get('/v1/media/:id/star',    starApi.auth(starApi.get('medium').bind(starApi), 'media', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

	}

	public getRouter(): Router {
		return this.router;
	}
}
