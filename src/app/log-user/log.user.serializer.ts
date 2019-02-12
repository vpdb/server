/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { state } from '../state';
import { UserDocument } from '../users/user.document';
import { LogUserDocument } from './log.user.document';

export class LogUserSerializer extends Serializer<LogUserDocument> {

	public readonly modelName: ModelName = 'LogUser';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [],
		simple: [],
		detailed: [],
	};

	protected _reduced(ctx: Context, doc: LogUserDocument, opts: SerializerOptions): LogUserDocument {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: LogUserDocument, opts: SerializerOptions): LogUserDocument {
		const logUser = pick(doc, ['event', 'result', 'message', 'logged_at']) as LogUserDocument;
		logUser.payload = doc.payload;

		// actor
		if (this._populated(doc, '_actor')) {
			logUser.actor = state.serializers.User.reduced(ctx, doc._actor as UserDocument, opts);
		}

		// creator
		if (this._populated(doc, '_user')) {
			logUser.user = state.serializers.User.reduced(ctx, doc._user as UserDocument, opts);
		}

		return logUser;
	}

	protected _detailed(ctx: Context, doc: LogUserDocument, opts: SerializerOptions): LogUserDocument {
		const logUser = this._simple(ctx, doc, opts);
		logUser.ip = doc.ip;
		return logUser;
	}

}
