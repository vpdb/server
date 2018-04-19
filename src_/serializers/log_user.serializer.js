const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const UserSerializer = require('../../src/users/user.serializer');

class LogUserSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const logUser = _.pick(doc, ['event', 'result', 'message', 'logged_at']);

		logUser.payload = doc.payload;

		// actor
		if (this._populated(doc, '_actor')) {
			logUser.actor = UserSerializer.reduced(doc._actor, req, opts);
		}

		// creator
		if (this._populated(doc, '_user')) {
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