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
import { GameRequest } from './game.request';
import { Context } from '../common/types/context';
import { Game } from '../games/game';
import { User } from '../users/user';

export class GameRequestSerializer extends Serializer<GameRequest> {

	protected _reduced(ctx: Context, doc: GameRequest, opts: SerializerOptions): GameRequest {
		return undefined;
	}

	protected _simple(ctx: Context, doc: GameRequest, opts: SerializerOptions): GameRequest {
		const gameRequest = pick(doc, ['id', 'title', 'notes', 'ipdb_number', 'ipdb_title', 'is_closed', 'message', 'created_at']) as GameRequest;

		// game
		if (this._populated(doc, '_game')) {
			gameRequest.game = ctx.serializers.Game.reduced(ctx, doc._game as Game, opts);
		}
		return gameRequest;
	}

	protected _detailed(ctx: Context, doc: GameRequest, opts: SerializerOptions): GameRequest {
		const gameRequest = this._simple(ctx, doc, opts);

		// creator
		if (this._populated(doc, '_created_by')) {
			gameRequest.created_by = ctx.serializers.User.reduced(ctx, doc._created_by as User, opts);
		}
		return gameRequest;
	}
}