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

import { Schema } from 'mongoose';
import mongoose = require('mongoose');
import Router from 'koa-router';

import { Models } from '../common/types/models';
import { Serializers } from '../common/types/serializers';
import { EndPoint } from '../common/types/endpoint';

import { User } from './user.type';
import { UserSerializer } from './user.serializer';
import { schema } from './user.schema';
import { router } from './user.api.router';

export class UserEndPoint implements EndPoint<User> {

	readonly name: string = 'users';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._router = router;
		this._schema = schema;
	}

	getRouter(): Router {
		return this._router;
	}

	registerModel(models: Models) {
		models.User = mongoose.model<User>('User', this._schema);
	}

	registerSerializer(serializers: Serializers): void {
		serializers.User = new UserSerializer();
	}
}