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

import mongoose from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { ApiRouter } from '../common/api.router';
import { state } from '../state';
import { initialTags } from './initial-data/tags';
import { TagApiRouter } from './tag.api.router';
import { TagDocument } from './tag.document';
import { tagSchema } from './tag.schema';
import { TagSerializer } from './tag.serializer';

export class TagApiEndPoint extends EndPoint {

	public readonly name: string = 'Tag API';
	private readonly router = new TagApiRouter();

	public getRouter(): ApiRouter {
		return this.router;
	}

	public registerModel(): EndPoint {
		state.models.Tag = mongoose.model<TagDocument>('Tag', tagSchema);
		return this;
	}

	public registerSerializer(): EndPoint {
		state.serializers.Tag = new TagSerializer();
		return this;
	}

	public async import(): Promise<void> {
		await this.importData(state.models.Tag, initialTags);
	}
}
