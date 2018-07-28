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
import { FileDocument } from '../files/file.document';
import { state } from '../state';
import { GameDocument, GameRestrictions } from './game.document';

export class GameSerializer extends Serializer<GameDocument> {

	protected _reduced(ctx: Context, doc: GameDocument, opts: SerializerOptions): GameDocument {

		const game = pick(doc, ['id', 'title', 'manufacturer', 'year' ]) as GameDocument;
		game.ipdb = doc.ipdb;
		return game;
	}

	protected _simple(ctx: Context, doc: GameDocument, opts: SerializerOptions): GameDocument {
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
			game.backglass = state.serializers.File.simple(ctx, doc._backglass as FileDocument, opts);
		}

		// logo
		if (this._populated(doc, '_logo')) {
			game.logo = state.serializers.File.simple(ctx, doc._logo as FileDocument, opts);
		}

		return game;
	}

	protected _detailed(ctx: Context, doc: GameDocument, opts: SerializerOptions): GameDocument {
		const game = Object.assign({}, this._simple(ctx, doc, opts), pick(doc,
			[ 'created_at', 'designers', 'features', 'keywords', 'metrics', 'notes', 'pinside', 'short', 'themes']));
		game.owner = ipdb.owners[doc.ipdb.mfg] || doc.manufacturer;
		return game;
	}
}
