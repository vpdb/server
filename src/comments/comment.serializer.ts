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

import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { CommentDocument } from './comment.document';

export class CommentSerializer extends Serializer<CommentDocument> {

	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [ { path: 'from', modelName: 'User', level: 'reduced' } ],
		simple: [ { path: 'from', modelName: 'User', level: 'reduced' } ],
		detailed: [ { path: 'from', modelName: 'User', level: 'reduced' } ],
	};

	/* istanbul ignore next */
	protected _reduced(ctx: Context, doc: CommentDocument, opts: SerializerOptions): CommentDocument {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: CommentDocument, opts: SerializerOptions): CommentDocument {
		const comment = pick(doc, ['id', 'message', 'created_at']) as CommentDocument;
		if (this._populated(doc, '_from')) {
			comment.from = state.serializers.User.reduced(ctx, doc._from as UserDocument, opts);
		}
		// if (this._populated(doc, '_ref.release')) {
		// 	comment.release = state.serializers.Release.reduced(ctx, doc._ref.release as Release, opts);
		// }
		return comment;
	}

	/* istanbul ignore next */
	protected _detailed(ctx: Context, doc: CommentDocument, opts: SerializerOptions): CommentDocument {
		return this._simple(ctx, doc, opts);
	}
}
