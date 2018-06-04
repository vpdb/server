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

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Tag } from './tag';
import { Context } from '../common/types/context';
import { pick } from 'lodash';
import { User } from '../users/user';

export class TagSerializer extends Serializer<Tag> {

	protected _reduced(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		return pick(doc, ['id']) as Tag;
	}

	protected _simple(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		const tag = pick(doc, ['id', 'name', 'description']) as Tag;
		// created_by
		if (this._populated(doc, '_created_by')) {
			tag.created_by = state.serializers.User.reduced(ctx, tag._created_by as User, opts);
		}
		return tag;
	}

	protected _detailed(ctx: Context, doc: Tag, opts: SerializerOptions): Tag {
		return this._simple(ctx, doc, opts);
	}
}