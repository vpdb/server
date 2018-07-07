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

import { isEmpty, pick } from 'lodash';

import { ipdb } from '../common/ipdb';
import { Serializer, SerializerOptions } from '../common/serializer';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { File } from '../files/file';
import { state } from '../state';
import { Game, GameRestrictions } from './game';

export class GameSerializer extends Serializer<Game> {

	protected _reduced(ctx: Context, doc: Game, opts: SerializerOptions): Game {

		const game = pick(doc, ['id', 'title', 'manufacturer', 'year' ]) as Game;
		game.ipdb = doc.ipdb;
		return game;
	}

	protected _simple(ctx: Context, doc: Game, opts: SerializerOptions): Game {
		const game = this._reduced(ctx, doc, opts);

		game.game_type = doc.game_type;
		game.counter = doc.counter;
		game.rating = doc.rating;

		// restrictions
		const restrictions: GameRestrictions = {};
		if (config.vpdb.restrictions.release.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.release = { mpu: true };
		}
		if (config.vpdb.restrictions.backglass.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.backglass = { mpu: true };
		}
		if (config.vpdb.restrictions.rom.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.rom = { mpu: true };
		}
		if (!isEmpty(restrictions)) {
			game.restrictions = restrictions;
		}

		// mpu
		if (doc.ipdb.mpu && ipdb.systems[doc.ipdb.mpu]) {
			game.mpu = ipdb.systems[doc.ipdb.mpu];
		}

		// backglass
		if (this._populated(doc, '_backglass')) {
			game.backglass = state.serializers.File.simple(ctx, doc._backglass as File, opts);
		}

		// logo
		if (this._populated(doc, '_logo')) {
			game.logo = state.serializers.File.simple(ctx, doc._logo as File, opts);
		}

		return game;
	}

	protected _detailed(ctx: Context, doc: Game, opts: SerializerOptions): Game {
		const game = this._simple(ctx, doc, opts);
		game.owner = ipdb.owners[doc.ipdb.mfg] || doc.manufacturer;
		return game;
	}
}
