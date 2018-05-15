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
import { Schema } from 'mongoose';
import { EndPoint } from '../common/types/endpoint';

import { schema } from './file.schema';
import { FileSerializer } from './file.serializer';
import Application = require('koa');
import { prefixes as apiPrefixes, router as apiRouter } from './file.api.router';
import { prefixes as storagePrefixes, router as storageRouter } from './file.storage.router';

export class FilesApiEndPoint implements EndPoint {

	readonly name: string = 'files';
	readonly paths: string[] = apiPrefixes;

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._schema = schema;
		this._router = apiRouter;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		app.context.serializers.File = new FileSerializer();
	}
}

export class FilesStorageEndPoint implements EndPoint {

	readonly name: string = 'storage files';
	readonly paths: string[] = storagePrefixes;

	private readonly _router: Router;

	constructor() {
		this._router = storageRouter;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		// nothing to register
	}
}