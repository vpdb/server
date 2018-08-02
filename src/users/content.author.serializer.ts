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

import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { state } from '../state';
import { ContentAuthor } from './content.author';
import { UserDocument } from './user.document';

export class ContentAuthorSerializer extends Serializer<ContentAuthor> {

	public readonly modelName: ModelName = null;
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [ { path: 'user', modelName: 'User', level: 'reduced' } ],
		simple: [ { path: 'user', modelName: 'User', level: 'simple' } ],
		detailed: [],
	};

	protected _reduced(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: state.serializers.User.reduced(ctx, doc._user as UserDocument, opts),
			roles: doc.roles,
		} as ContentAuthor;
	}

	/* istanbul ignore next: Actually never used */
	protected _simple(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return {
			user: state.serializers.User.simple(ctx, doc._user as UserDocument, opts),
			roles: doc.roles,
		} as ContentAuthor;
	}

	/* istanbul ignore next */
	protected _detailed(ctx: Context, doc: ContentAuthor, opts: SerializerOptions): ContentAuthor {
		return undefined;
	}
}
