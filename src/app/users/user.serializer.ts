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

import { assign, find, isEmpty, mapValues, pick, pickBy, uniq } from 'lodash';
import { Serializer, SerializerLevel, SerializerOptions, SerializerReference } from '../common/serializer';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { ModelName } from '../common/typings/models';
import { UserDocument } from './user.document';
import { UserUtil } from './user.util';

export class UserSerializer extends Serializer<UserDocument> {

	public readonly modelName: ModelName = 'User';
	public readonly references: { [level in SerializerLevel]: SerializerReference[] } = {
		reduced: [],
		simple: [],
		detailed: [],
	};

	/**
	 * User info in other data.
	 */
	protected _reduced(ctx: Context, doc: UserDocument, opts: SerializerOptions): UserDocument {
		const user: UserDocument = pick(doc, ['id', 'name', 'username']) as UserDocument;

		// gravatar
		user.gravatar_id = UserUtil.getGravatarHash(doc);

		// provider id
		if (ctx.state.tokenType === 'provider' && doc.providers && doc.providers[ctx.state.tokenProvider]) {
			user.provider_id = doc.providers[ctx.state.tokenProvider].id;
		}
		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 */
	protected _simple(ctx: Context, doc: UserDocument, opts: SerializerOptions): UserDocument {
		const user: UserDocument = this._reduced(ctx, doc, opts);
		assign(user, pick(doc, ['location']));

		// counter
		user.counter = pick(doc.counter, ['comments', 'stars']);
		return user;
	}

	/**
	 * User details for admins, or profile data
	 */
	protected _detailed(ctx: Context, doc: UserDocument, opts: SerializerOptions): UserDocument {
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
