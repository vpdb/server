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
import { GameDocument } from '../games/game.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { BackglassDocument } from './backglass.document';
import { BackglassVersion } from './backglass.version';

export class BackglassSerializer extends Serializer<BackglassDocument> {

	protected _reduced(ctx: Context, doc: BackglassDocument, opts: SerializerOptions): BackglassDocument {
		return this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.reduced.bind(state.serializers.BackglassVersion));
	}

	protected _simple(ctx: Context, doc: BackglassDocument, opts: SerializerOptions): BackglassDocument {
		return this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.simple.bind(state.serializers.BackglassVersion));
	}

	protected _detailed(ctx: Context, doc: BackglassDocument, opts: SerializerOptions): BackglassDocument {
		const backglass = this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.simple.bind(state.serializers.BackglassVersion));

		// creator
		if (this._populated(doc, '_created_by')) {
			backglass.created_by = state.serializers.User.reduced(ctx, doc._created_by as UserDocument, opts);
		}

		return backglass;
	}

	private _serialize(ctx: Context, doc: BackglassDocument, opts: SerializerOptions,
					   versionSerializer: (ctx: Context, doc: BackglassVersion, opts: SerializerOptions) => BackglassVersion): BackglassDocument {

		// primitive fields
		const backglass = pick(doc, ['id', 'description', 'acknowledgements', 'created_at']) as BackglassDocument;

		// versions
		backglass.versions = doc.versions.map(version => versionSerializer(ctx, version, opts));

		// game
		if (this._populated(doc, '_game')) {
			backglass.game = state.serializers.Game.reduced(ctx, doc._game as GameDocument, opts);
		}

		// authors
		if (this._populated(doc, 'authors._user')) {
			backglass.authors = doc.authors.map(author => state.serializers.ContentAuthor.reduced(ctx, author, opts));
		}

		return backglass;
	}
}
