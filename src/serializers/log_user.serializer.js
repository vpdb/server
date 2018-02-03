const _ = require('lodash');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');
const UserSerializer = require('./user.serializer');

class LogUserSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const logUser = _.pick(doc, ['event', 'payload', 'result', 'message', 'logged_at']);

		// actor
		if (doc.populated('_actor')) {
			logUser.actor = UserSerializer.reduced(doc._actor, req, opts);
		}

		// creator
		if (doc.populated('_user')) {
			logUser.user = UserSerializer.reduced(doc._user, req, opts);
		}

		return logUser;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const logUser = this._simple(doc, req, opts);
		logUser.ip = doc.ip;
		return logUser;
	}
}

module.exports = new LogUserSerializer();