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
import mongoose, { Document, Schema } from 'mongoose';

import { state } from '../state';
import { EndPoint } from '../common/api.endpoint';
import { TagSerializer } from './tag.serializer';
import { tagSchema } from './tag.schema';
import { router } from './tag.api.router';
import { Tag } from './tag';
import { initialTags } from './initial-data/tags';

export class TagApiEndPoint extends EndPoint {

	readonly name: string = 'Build API';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		super();
		this._schema = tagSchema;
		this._router = router;
	}

	getRouter(): Router {
		return this._router;
	}

	async register(app: Application): Promise<void> {
		state.models.Tag = mongoose.model<Tag>('Tag', this._schema);
		state.serializers.Tag = new TagSerializer();

		// import data
		await this.importData(state.models.Tag, initialTags);
	}
}
