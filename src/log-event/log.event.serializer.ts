
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

import { BackglassDocument } from '../backglasses/backglass.document';
import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { GameRequestDocument } from '../game-requests/game.request.document';
import { GameDocument } from '../games/game.document';
import { ReleaseDocument } from '../releases/release.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { LogEventDocument } from './log.event.document';

export class LogEventSerializer extends Serializer<LogEventDocument> {

	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [],
		simple: [],
		detailed: [],
	};

	protected _reduced(ctx: Context, doc: LogEventDocument, opts: SerializerOptions): LogEventDocument {
		const logEvent = pick(doc, ['event', 'is_public', 'logged_at']) as LogEventDocument;
		logEvent.payload = doc.payload;
		return logEvent;
	}

	protected _simple(ctx: Context, doc: LogEventDocument, opts: SerializerOptions): LogEventDocument {
		const logEvent = this._reduced(ctx, doc, opts);

		// actor
		if (this._populated(doc, '_actor')) {
			logEvent.actor = state.serializers.User.reduced(ctx, doc._actor as UserDocument, opts);
		}

		// references
		logEvent.ref = {};
		if (this._populated(doc, '_ref.game')) {
			logEvent.ref.game = state.serializers.Game.reduced(ctx, doc._ref.game as GameDocument, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			logEvent.ref.release = state.serializers.Release.reduced(ctx, doc._ref.release as ReleaseDocument, opts);
		}
		if (this._populated(doc, '_ref.backglass')) {
			logEvent.ref.backglass = state.serializers.Backglass.reduced(ctx, doc._ref.backglass as BackglassDocument, opts);
		}
		if (this._populated(doc, '_ref.user')) {
			logEvent.ref.user = state.serializers.User.reduced(ctx, doc._ref.user as UserDocument, opts);
		}
		if (this._populated(doc, '_ref.game_request')) {
			logEvent.ref.game_request = state.serializers.GameRequest.reduced(ctx, doc._ref.game_request as GameRequestDocument, opts);
		}
		if (isEmpty(logEvent.ref)) {
			logEvent.ref = undefined;
		}

		return logEvent;
	}

	protected _detailed(ctx: Context, doc: LogEventDocument, opts: SerializerOptions): LogEventDocument {
		const logEvent = this._simple(ctx, doc, opts);
		logEvent.ip = doc.ip;
		return logEvent;
	}
}
