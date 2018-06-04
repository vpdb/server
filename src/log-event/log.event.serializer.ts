
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
import { pick, isEmpty } from 'lodash';

import { state } from '../state';
import { Serializer, SerializerOptions } from '../common/serializer';
import { LogEvent } from './log.event';
import { Context } from '../common/types/context';
import { User } from '../users/user';
import { Game } from '../games/game';
import { Release } from '../releases/release';
import { Backglass } from '../backglasses/backglass';
import { GameRequest } from '../game-requests/game.request';

export class LogEventSerializer extends Serializer<LogEvent> {

	protected _reduced(ctx: Context, doc: LogEvent, opts: SerializerOptions): LogEvent {
		const logEvent = pick(doc, ['event', 'is_public', 'logged_at']) as LogEvent;
		logEvent.payload = doc.payload;
		return logEvent;
	}

	protected _simple(ctx: Context, doc: LogEvent, opts: SerializerOptions): LogEvent {
		const logEvent = this._reduced(ctx, doc, opts);

		// actor
		if (this._populated(doc, '_actor')) {
			logEvent.actor = state.serializers.User.reduced(ctx, doc._actor as User, opts);
		}

		// references
		logEvent.ref = {};
		if (this._populated(doc, '_ref.game')) {
			logEvent.ref.game = state.serializers.Game.reduced(ctx, doc._ref.game as Game, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			logEvent.ref.release = state.serializers.Release.reduced(ctx, doc._ref.release as Release, opts);
		}
		if (this._populated(doc, '_ref.backglass')) {
			logEvent.ref.backglass = state.serializers.Backglass.reduced(ctx, doc._ref.backglass as Backglass, opts);
		}
		if (this._populated(doc, '_ref.user')) {
			logEvent.ref.user = state.serializers.User.reduced(ctx, doc._ref.user as User, opts);
		}
		if (this._populated(doc, '_ref.game_request')) {
			logEvent.ref.game_request = state.serializers.GameRequest.reduced(ctx, doc._ref.game_request as GameRequest, opts);
		}
		if (isEmpty(logEvent.ref)) {
			delete logEvent.ref;
		}

		return logEvent;
	}

	protected _detailed(ctx: Context, doc: LogEvent, opts: SerializerOptions): LogEvent {
		const logEvent = this._simple(ctx, doc, opts);
		logEvent.ip = doc.ip;
		return logEvent;
	}
}