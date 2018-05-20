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
import mongoose, { Schema } from 'mongoose';
import Router from 'koa-router';

import { state } from '../state';
import { EndPoint } from '../common/types/endpoint';
import { Token } from './token';
import { tokenSchema } from './token.schema';
import { router } from './token.api.router';
import { TokenSerializer } from './token.serializer';

export class TokenEndPoint implements EndPoint {

	readonly name: string = 'Token API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._router = router;
		this._schema = tokenSchema;
	}

	getRouter(): Router {
		return this._router;
	}

	register(app: Application): void {
		state.models.Token = mongoose.model<Token>('Token', this._schema);
		state.serializers.Token = new TokenSerializer();
	}
}