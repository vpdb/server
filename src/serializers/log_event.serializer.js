const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const ReleaseSerializer = require('./release.serializer');
const BackglassSerializer = require('./backglass.serializer');
const UserSerializer = require('./user.serializer');
const GameRequestSerializer = require('./game_request.serializer');

class LogEventSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return _.pick(doc, ['event', 'payload', 'is_public', 'logged_at']);
	}

	/** @protected */
	_simple(doc, req, opts) {
		const logEvent = this._reduced(doc, req, opts);

		logEvent.ref = {};

		// references
		if (doc.populated('_ref.game')) {
			logEvent.ref.game = GameSerializer.reduced(doc._ref.game, req, opts);
		}
		if (doc.populated('_ref.release')) {
			logEvent.ref.release = ReleaseSerializer.reduced(doc._ref.release, req, opts);
		}
		if (doc.populated('_ref.backglass')) {
			logEvent.ref.backglass = BackglassSerializer.reduced(doc._ref.backglass, req, opts);
		}
		if (doc.populated('_ref.user')) {
			logEvent.ref.user = UserSerializer.reduced(doc._ref.user, req, opts);
		}
		if (doc.populated('_ref.game_request')) {
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