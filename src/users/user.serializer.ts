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

import { createHash } from 'crypto';
import { assign, find, isEmpty, keys, mapValues, pick, pickBy, uniq } from 'lodash';
import { realtime } from '../common/realtime';
import { Serializer, SerializerOptions } from '../common/serializer';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { User } from './user';

export class UserSerializer extends Serializer<User> {

	/**
	 * User info in other data.
	 */
	protected _reduced(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user: User = pick(doc, ['id', 'name', 'username']) as User;

		// gravatar
		user.gravatar_id = doc.email ? createHash('md5').update(doc.email.toLowerCase()).digest('hex') : null;

		// provider id
		if (ctx.state.tokenType === 'provider' && doc.providers[ctx.state.tokenProvider]) {
			user.provider_id = doc.providers[ctx.state.tokenProvider].id;
		}
		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 */
	protected _simple(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user: User = this._reduced(ctx, doc, opts);
		assign(user, pick(doc, ['location']));

		// counter
		user.counter = pick(doc.counter, ['comments', 'stars']);
		return user;
	}

	/**
	 * User details for admins, or profile data
	 */
	protected _detailed(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user = this._simple(ctx, doc, opts);
		assign(user, pick(doc, ['email', 'email_status', 'is_local', 'is_active', 'created_at']));

		user.roles = doc.roles;
		user.preferences = doc.preferences;
		user.counter = doc.counter;

		// plan
		const plan = find(config.vpdb.quota.plans, p => p.id === doc._plan);
		user.plan = {
			id: doc._plan,
			app_tokens_enabled: plan.enableAppTokens,
			push_notifications_enabled: plan.enableRealtime,
		};

		// pusher
		if (realtime.isUserEnabled(doc)) {
			user.channel_config = doc.channel_config;
			user.channel_config.api_key = config.vpdb.pusher.options.key;
		}

		// emails
		user.emails = uniq([...doc.emails, ...doc.validated_emails]);

		// email status
		if (doc.email_status.code === 'confirmed') {
			user.email_status = undefined;
		} else if (process.env.NODE_ENV !== 'test') {
			user.email_status.token = undefined;
		}

		// provider data
		user.providers = pickBy(mapValues(doc.providers, val => pick(val, ['id', 'name', 'emails', 'created_at', 'modified_at'])), o => !isEmpty(o));

		return user;
	}
}
