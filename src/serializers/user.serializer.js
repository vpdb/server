const _ = require('lodash');
const crypto = require('crypto');
const Serializer = require('./serializer');

const pusher = require('../modules/pusher');
const config = require('../modules/settings').current;

class UserSerializer extends Serializer {

	/**
	 * User info in other data.
	 * @protected
	 */
	_reduced(doc, req, opts) {
		const user = _.pick(doc, ['id', 'name']);

		// gravatar
		user.gravatar_id = doc.email ? crypto.createHash('md5').update(doc.email.toLowerCase()).digest('hex') : null;

		// provider id
		if (opts.includeProviderId && doc[opts.includeProviderId]) {
			user.provider_id = doc[opts.includeProviderId].id;
		}

		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 * @protected
	 */
	_simple(doc, req, opts) {
		const user = this._reduced(doc, req, opts);
		_.assign(user, _.pick(doc, [ 'username', 'location' ]));

		// counter
		user.counter = _.pick(doc.counter, ['comments', 'stars']);

		return user;
	}

	/**
	 * User details for admins, or profile data
	 * @protected
	 */
	_detailed(doc, req, opts) {
		const user = this._reduced(doc, req, opts);
		_.assign(user, _.pick(doc, ['email', 'is_active', 'provider', 'roles', 'created_at', 'preferences', 'counter', 'email_status']));

		// plan
		const plan = _.find(config.vpdb.quota.plans, p => p.id === doc._plan);
		user.plan = {
			id: doc._plan,
			app_tokens_enabled: plan.enableAppTokens,
			push_notifications_enabled: plan.enableRealtime
		};

		// pusher
		if (pusher.isUserEnabled(doc)) {
			user.channel_config = doc.channel_config;
			user.channel_config.api_key = config.vpdb.pusher.options.key;
		}

		// email status
		if (doc.email_status.code === 'confirmed') {
			delete user.email_status;
		} else {
			delete user.email_status.token;
		}

		// provider data
		if (!_.isEmpty(user.github)) {
			user.github = {
				id: user.github.id,
				username: user.github.login,
				email: user.github.email,
				avatar_url: user.github.avatar_url,
				html_url: user.github.html_url
			};
		}
		if (!_.isEmpty(user.google)) {
			user.google ={
				id: user.google.id,
				username: user.google.login,
				email: user.google.email,
				avatar_url: user.avatar_url,
				html_url: user.google.html_url
			};
		}
		return user;
	}

}

module.exports = new UserSerializer();