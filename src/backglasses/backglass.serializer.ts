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

import { state } from '../state';
import { Backglass } from './backglass';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/types/context';
import { BackglassVersion } from './backglass.version';
import { Game } from '../games/game';
import { User } from '../users/user';

export class BackglassSerializer extends Serializer<Backglass> {


	protected _reduced(ctx: Context, doc: Backglass, opts: SerializerOptions): Backglass {
		return this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.reduced.bind(state.serializers.BackglassVersion));
	}

	protected _simple(ctx: Context, doc: Backglass, opts: SerializerOptions): Backglass {
		return this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.simple.bind(state.serializers.BackglassVersion));
	}

	protected _detailed(ctx: Context, doc: Backglass, opts: SerializerOptions): Backglass {
		const backglass = this._serialize(ctx, doc, opts, state.serializers.BackglassVersion.simple.bind(state.serializers.BackglassVersion));

		// creator
		if (this._populated(doc, '_created_by')) {
			backglass.created_by = state.serializers.User.reduced(ctx, doc._created_by as User, opts);
		}
		return backglass;
	}

	private _serialize(ctx:Context, doc:Backglass, opts:SerializerOptions,
					   versionSerializer:(ctx: Context, doc: BackglassVersion, opts: SerializerOptions) => BackglassVersion): Backglass {

		// primitive fields
		const backglass = pick(doc, ['id', 'description', 'acknowledgements', 'created_at']) as Backglass;

		// versions
		backglass.versions = doc.versions.map(version => versionSerializer(ctx, version, opts));

		// game
		if (this._populated(doc, '_game')) {
			backglass.game = state.serializers.Game.reduced(ctx, doc._game as Game, opts);
		}

		// authors
		if (this._populated(doc, 'authors._user')) {
			backglass.authors = doc.authors.map(author => state.serializers.ContentAuthor.reduced(ctx, author, opts));
		}

		return backglass;
	}
}