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
import { default as mongoose, Schema } from 'mongoose';

import { Models } from '../common/types/models';
import { EndPoint } from '../common/types/endpoint';
import { Serializers } from '../common/types/serializers';
import { File } from './file';
import { FileSerializer } from './file.serializer';
import { fileSchema } from './file.schema';
import { router as apiRouter } from './file.api.router';
import { router as storageRouter } from './file.storage.router';

export class FilesApiEndPoint implements EndPoint {

	readonly name: string = 'Files API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._schema = fileSchema;
		this._router = apiRouter;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		(app.context.models as Models).File = mongoose.model<File>('File', this._schema);
		(app.context.serializers as Serializers).File = new FileSerializer();
	}
}

export class FilesStorageEndPoint implements EndPoint {

	readonly name: string = 'Storage Files API';

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