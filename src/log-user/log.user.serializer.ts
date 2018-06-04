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
import { Serializer, SerializerOptions } from '../common/serializer';
import { Context } from '../common/types/context';
import { LogUser } from './log.user';
import { User } from '../users/user';

export class LogUserSerializer extends Serializer<LogUser> {

	protected _reduced(ctx: Context, doc: LogUser, opts: SerializerOptions): LogUser {
		return this._simple(ctx, doc, opts);
	}

	protected _simple(ctx: Context, doc: LogUser, opts: SerializerOptions): LogUser {
		const logUser = pick(doc, ['event', 'result', 'message', 'logged_at']) as LogUser;
		logUser.payload = doc.payload;

		// actor
		if (this._populated(doc, '_actor')) {
			logUser.actor = state.serializers.User.reduced(ctx, doc._actor as User, opts);
		}

		// creator
		if (this._populated(doc, '_user')) {
			logUser.user = state.serializers.User.reduced(ctx, doc._user as User, opts);
		}

		return logUser;
	}

	protected _detailed(ctx: Context, doc: LogUser, opts: SerializerOptions): LogUser {
		const logUser = this._simple(ctx, doc, opts);
		logUser.ip = doc.ip;
		return logUser;
	}

}