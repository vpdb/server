import { assign, pick, find, uniq, mapValues } from 'lodash';
import { Serializer, SerializerOptions } from '../common/serializer';
import { User, UserCounter } from './user.type';
import { Context } from 'koa';

const crypto = require('crypto');

//const pusher = require('../../src_/modules/pusher');
const config = require('../common/settings').current;

export class UserSerializer extends Serializer<User> {

	/**
	 * User info in other data.
	 * @protected
	 */
	protected _reduced(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user: User = pick(doc, ['id', 'name', 'username']) as User;

		// gravatar
		user.gravatar_id = doc.email ? crypto.createHash('md5').update(doc.email.toLowerCase()).digest('hex') : null;

		// provider id
		if (ctx.state.tokenType === 'application' && doc.providers[ctx.state.tokenProvider]) {
			user.provider_id = doc.providers[ctx.state.tokenProvider].id;
		}
		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 * @protected
	 */
	protected _simple(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user: User = this._reduced(ctx, doc, opts);
		assign(user, pick(doc, ['location']));

		// counter
		user.counter = pick(doc.counter.toObject(), ['comments', 'stars']) as UserCounter;
		return user;
	}

	/**
	 * User details for admins, or profile data
	 * @protected
	 */
	protected _detailed(ctx: Context, doc: User, opts: SerializerOptions): User {
		const user = this._simple(ctx, doc, opts);
		assign(user, pick(doc, ['email', 'email_status', 'is_local', 'is_active', 'created_at']));

		user.roles = doc.roles;
		user.preferences = doc.preferences.toObject();
		user.counter = doc.counter.toObject();

		// plan
		const plan = find(config.vpdb.quota.plans, p => p.id === doc._plan);
		user.plan = {
			id: doc._plan,
			app_tokens_enabled: plan.enableAppTokens,
			push_notifications_enabled: plan.enableRealtime
		};

		// pusher
		// if (pusher.isUserEnabled(doc)) {
		// 	user.channel_config = doc.channel_config;
		// 	user.channel_config.api_key = config.vpdb.pusher.options.key;
		// }

		// emails
		user.emails = uniq([...doc.emails, ...doc.validated_emails]);

		// email status
		if (doc.email_status.code === 'confirmed') {
			user.email_status = undefined;
		} else if (process.env.NODE_ENV !== 'test') {
			user.email_status.token = undefined;
		}

		// provider data
		user.providers = mapValues(doc.providers, val => pick(val, ['id', 'name', 'emails', 'created_at', 'modified_at']));

		return user;
	}

}