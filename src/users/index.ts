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
import mongoose, { Schema } from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { state } from '../state';
import { ContentAuthorSerializer } from './content.author.serializer';
import { User } from './user';
import { router } from './user.api.router';
import { UserModel, userSchema } from './user.schema';
import { UserSerializer } from './user.serializer';

export class UserEndPoint extends EndPoint {

	public readonly name: string = 'User API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		super();
		this._router = router;
		this._schema = userSchema;
	}

	public getRouter(): Router {
		return this._router;
	}

	public async register(app: Application): Promise<void> {
		state.models.User = mongoose.model<User, UserModel>('User', this._schema);
		state.serializers.User = new UserSerializer();
		state.serializers.ContentAuthor = new ContentAuthorSerializer();
	}
}
