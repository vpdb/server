const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const UserSerializer = require('./user.serializer');

class GameRequestSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const gameRequest = _.pick(doc, ['id', 'title', 'notes', 'ipdb_number', 'ipdb_title', 'is_closed', 'message', 'created_at']);

		// game
		gameRequest.game = GameSerializer.reduced(doc._game, req, opts);

		return gameRequest;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const gameRequest = this._simple(doc, req, opts);

		// creator
		gameRequest.created_by = UserSerializer.reduced(doc, req, opts);

		return gameRequest;
	}
}

module.exports = new GameRequestSerializer();