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

import { pick } from 'lodash';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/typings/context';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { TagDocument } from './tag.document';

export class TagSerializer extends Serializer<TagDocument> {

	protected _reduced(ctx: Context, doc: TagDocument, opts: SerializerOptions): TagDocument {
		return pick(doc, ['id']) as TagDocument;
	}

	protected _simple(ctx: Context, doc: TagDocument, opts: SerializerOptions): TagDocument {
		const tag = pick(doc, ['id', 'name', 'description']) as TagDocument;
		// created_by
		if (this._populated(doc, '_created_by')) {
			tag.created_by = state.serializers.User.reduced(ctx, tag._created_by as UserDocument, opts);
		}
		return tag;
	}

	/* istanbul ignore next */
	protected _detailed(ctx: Context, doc: TagDocument, opts: SerializerOptions): TagDocument {
		return this._simple(ctx, doc, opts);
	}
}
