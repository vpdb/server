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

import { Serializer, SerializerOptions } from '../common/serializer';
import { Medium } from './medium';
import { Context } from '../common/types/context';
import { pick } from 'lodash';
import { File } from '../files/file';
import { state } from '../state';
import { Game } from '../games/game';
import { User } from '../users/user';
import { Release } from '../releases/release';

export class MediumSerializer extends Serializer<Medium> {

	protected _reduced(ctx: Context, doc: Medium, opts: SerializerOptions): Medium {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: Medium, opts: SerializerOptions): Medium {
		const medium = pick(doc, ['id', 'category', 'description', 'acknowledgements', 'created_at']) as Medium;
		if (this._populated(doc, '_file')) {
			medium.file = state.serializers.File.detailed(ctx, doc._file as File, opts);
		}
		if (this._populated(doc, '_created_by')) {
			medium.created_by = state.serializers.User.reduced(ctx, doc._created_by as User, opts);
		}
		if (this._populated(doc, '_ref.game')) {
			medium.game = state.serializers.Game.simple(ctx, doc._ref.game as Game, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			medium.release = state.serializers.Release.simple(ctx, doc._ref.release as Release, opts);
		}
		return medium;
	}

	protected _detailed(ctx: Context, doc: Medium, opts: SerializerOptions): Medium {
		return this._simple(ctx, doc, opts);
	}
}
