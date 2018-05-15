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

import mongoose, { Schema } from 'mongoose';
import Router from 'koa-router';
import { EndPoint } from '../common/types/endpoint';

import { schema } from './log.user.schema';
import { LogUser } from './log.user';
import Application = require('koa');

export class LogUserEndPoint implements EndPoint {

	readonly name: string = 'Userlog API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._schema = schema;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		app.context.models.LogUser = mongoose.model<LogUser>('LogUser', this._schema);
	}
}