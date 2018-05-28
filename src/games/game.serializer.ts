import { isEmpty, pick } from 'lodash';

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { Game, GameRestrictions } from './game';
import { File } from '../files/file';
import { Context } from '../common/types/context';
import { config } from '../common/settings';
import { ipdb } from '../common/ipdb';

export class GameSerializer extends Serializer<Game> {

	protected _reduced(ctx: Context, doc: Game, opts: SerializerOptions): Game {

		const game = pick(doc, ['id', 'title', 'manufacturer', 'year' ]) as Game;
		if (doc.ipdb) {
			game.ipdb = (doc.ipdb as any).toObject();
		}
		return game;
	}

	protected _simple(ctx: Context, doc: Game, opts: SerializerOptions): Game {
		const game = this._reduced(ctx, doc, opts);

		game.game_type = doc.game_type;
		game.counter = (doc.counter as any).toObject();
		game.rating = (doc.rating as any).toObject();

		// restrictions
		const restrictions:GameRestrictions = {};
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