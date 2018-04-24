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

import Application from 'koa';
import koaLogger from 'koa-logger';
import koaBodyParser from 'koa-bodyparser';
import { EndPoint } from './common/types/endpoint';
import { Models } from './common/types/models';
import { Serializers } from './common/types/serializers';
import { config } from './common/settings'

export class Server {

	private app: Application;

	constructor() {
		this.app = new Application();
		this.app.use(koaLogger());
		this.app.use(koaBodyParser());

		this.app.context.models = {};
		this.app.context.serializers = {};
	}

	public register<T>(endPoint: EndPoint<T>) {
		// routes
		this.app.use(endPoint.getRouter().routes());
		this.app.use(endPoint.getRouter().allowedMethods());

		// model
		endPoint.registerModel(this.app.context.models);

		// serializer
		endPoint.registerSerializer(this.app.context.serializers);
	}

	public start() {
		console.log('Listening on port %s.', config.vpdb.api.port);
		this.app.listen(config.vpdb.api.port);
	}

	public models(): Models {
		return this.app.context.models;
	}

	public serializers(): Serializers {
		return this.app.context.serializers;
	}
}

export const server = new Server();