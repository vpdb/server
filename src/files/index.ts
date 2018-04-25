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

//import { schema } from './log.user.schema';
import { FileSerializer } from './file.serializer';
import Application = require('koa');

export class FilesEndPoint implements EndPoint {

	readonly name: string = 'files';
	readonly paths: string[] = [];

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		// this._schema = schema;
		// this._router = router;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		app.context.serializers.File = new FileSerializer();
	}
}