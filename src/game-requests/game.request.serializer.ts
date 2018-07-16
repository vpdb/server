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
import { GameRequestDocument } from './game.request.document';

export class GameRequestSerializer extends Serializer<GameRequestDocument> {

	protected _reduced(ctx: Context, doc: GameRequestDocument, opts: SerializerOptions): GameRequestDocument {
		return undefined;
	}

	protected _simple(ctx: Context, doc: GameRequestDocument, opts: SerializerOptions): GameRequestDocument {
		const gameRequest = pick(doc, ['id', 'title', 'notes', 'ipdb_number', 'ipdb_title', 'is_closed', 'message', 'created_at']) as GameRequestDocument;

		// game
		if (this._populated(doc, '_game')) {
			gameRequest.game = state.serializers.Game.reduced(ctx, doc._game as GameDocument, opts);
		}
		return gameRequest;
	}

	protected _detailed(ctx: Context, doc: GameRequestDocument, opts: SerializerOptions): GameRequestDocument {
		const gameRequest = this._simple(ctx, doc, opts);

		// creator
		if (this._populated(doc, '_created_by')) {
			gameRequest.created_by = state.serializers.User.reduced(ctx, doc._created_by as UserDocument, opts);
		}
		return gameRequest;
	}
}
