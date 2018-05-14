const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const GameSerializer = require('./game.serializer');
const ReleaseSerializer = require('../../src/releases/release.serializer');
const BackglassSerializer = require('./backglass.serializer');
const UserSerializer = require('../../src/users/user.serializer');
const GameRequestSerializer = require('./game_request.serializer');

class LogEventSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		const logEvent = _.pick(doc, ['event', 'is_public', 'logged_at']);
		logEvent.payload = doc.payload;
		return logEvent;
	}

	/** @protected */
	_simple(doc, req, opts) {
		const logEvent = this._reduced(doc, req, opts);

		// actor
		if (this._populated(doc, '_actor')) {
			logEvent.actor = UserSerializer.reduced(doc._actor, req, opts);
		}

		// references
		logEvent.ref = {};
		if (this._populated(doc, '_ref.game')) {
			logEvent.ref.game = GameSerializer.reduced(doc._ref.game, req, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			logEvent.ref.release = ReleaseSerializer.reduced(doc._ref.release, req, opts);
		}
		if (this._populated(doc, '_ref.backglass')) {
			logEvent.ref.backglass = BackglassSerializer.reduced(doc._ref.backglass, req, opts);
		}
		if (this._populated(doc, '_ref.user')) {
			logEvent.ref.user = UserSerializer.reduced(doc._ref.user, req, opts);
		}
		if (this._populated(doc, '_ref.game_request')) {
			logEvent.ref.game_request = GameRequestSerializer.reduced(doc._ref.game_request, req, opts);
		}
		if (_.isEmpty(logEvent.ref)) {
			delete logEvent.ref;
		}

		return logEvent;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const logEvent = this._simple(doc, req, opts);
		logEvent.ip = doc.ip;
		return logEvent;
	}
}

module.exports = new LogEventSerializer();