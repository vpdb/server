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
		const user = _.pick(doc, ['id', 'name', 'username']);

		// gravatar
		user.gravatar_id = doc.email ? crypto.createHash('md5').update(doc.email.toLowerCase()).digest('hex') : null;

		// provider id
		if (req.tokenType === 'application' && doc[req.tokenProvider]) {
			user.provider_id = doc[req.tokenProvider].id;
		}

		return user;
	}

	/**
	 * User details for anon/members (when searching or clicking).
	 * @protected
	 */
	_simple(doc, req, opts) {
		const user = this._reduced(doc, req, opts);
		_.assign(user, _.pick(doc, ['location']));

		// counter
		user.counter = _.pick(doc.counter.toObject(), ['comments', 'stars']);

		return user;
	}

	/**
	 * User details for admins, or profile data
	 * @protected
	 */
	_detailed(doc, req, opts) {
		const user = this._simple(doc, req, opts);
		_.assign(user, _.pick(doc, ['email', 'email_status', 'emails', 'is_active', 'provider', 'created_at']));

		user.roles = doc.roles.toObject();
		user.preferences = doc.preferences.toObject();
		user.counter = doc.counter.toObject();

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
		user.providers = [];

		// provider data
		if (!_.isEmpty(doc.github)) {
			user.github = {
				id: doc.github.id,
				username: doc.github.login,
				email: doc.github.email,
				avatar_url: doc.github.avatar_url,
				html_url: doc.github.html_url
			};
			user.providers.push('github');
		}
		if (!_.isEmpty(doc.google)) {
			user.google = {
				id: doc.google.id,
				username: doc.google.login,
				email: doc.google.email,
				avatar_url: doc.google.avatar_url,
				html_url: doc.google.html_url
			};
			user.providers.push('google');
		}
		config.vpdb.passport.ipboard.forEach(ipb => {
			if (!_.isEmpty(doc[ipb.id])) {
				user[ipb.id] = {
					id: doc[ipb.id].id,
					username: doc[ipb.id].username,
					email: doc[ipb.id].email,
					avatar_url: doc[ipb.id].avatar,
					html_url: doc[ipb.id].profileUrl
				};
				user.providers.push(ipb.id);
			}
		});
		if (doc.password_hash) {
			user.providers.push('local');
		}
		return user;
	}

}

module.exports = new UserSerializer();