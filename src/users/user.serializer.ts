import { assign, pick, find } from 'lodash';
import { Serializer } from '../common/serializer';
import { User } from './user.type';
import { Context } from 'koa';
import { SerializerOptions } from '../common/types/serializer';

const _ = require('lodash');
const crypto = require('crypto');

//const pusher = require('../../src_/modules/pusher');
const config = require('../common/settings').current;

export class UserSerializer extends Serializer<User> {

	/**
	 * User info in other data.
	 * @protected
	 */
	_reduced(doc:User, ctx:Context, opts:SerializerOptions) {
		const user = pick(doc, ['id', 'name', 'username']);

		// gravatar
		user.gravatar_id = doc.email ? crypto.createHash('md5').update(doc.email.toLowerCase()).digest('hex') : null;

		// provider id
		if (ctx.state.tokenType === 'application' && doc[ctx.state.tokenProvider]) {
			user.provider_id = doc.providers[ctx.state.tokenProvider].id;
		}

		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 * @protected
	 */
	_simple(doc, ctx, opts) {
		const user = this._reduced(doc, ctx, opts);
		assign(user, pick(doc, ['location']));

		// counter
		user.counter = pick(doc.counter.toObject(), ['comments', 'stars']);

		return user;
	}

	/**
	 * User details for admins, or profile data
	 * @protected
	 */
	_detailed(doc, ctx, opts) {
		const user = this._simple(doc, ctx, opts);
		assign(user, pick(doc, ['email', 'email_status', 'is_local', 'is_active', 'created_at']));

		user.roles = doc.roles.toObject();
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
		user.emails = _.uniq([...doc.emails, ...doc.validated_emails]);

		// email status
		if (doc.email_status.code === 'confirmed') {
			user.email_status = undefined;
		} else if (process.env.NODE_ENV !== 'test') {
			user.email_status.token = undefined;
		}

		// provider data
		user.providers = _.keys(doc.providers)
			.filter(k => doc.providers[k] && doc.providers[k].id)
			.map(k => _.assign({ provider: k }, _.pick(doc.providers[k], [ 'id', 'name', 'emails', 'created_at', 'modified_at' ])));

		return user;
	}

}