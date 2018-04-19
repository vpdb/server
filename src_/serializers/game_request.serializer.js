const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const GameSerializer = require('./game.serializer');
const UserSerializer = require('../../src/users/user.serializer');

class GameRequestSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const gameRequest = _.pick(doc, ['id', 'title', 'notes', 'ipdb_number', 'ipdb_title', 'is_closed', 'message', 'created_at']);

		// game
		if (this._populated(doc, '_game')) {
			gameRequest.game = GameSerializer.reduced(doc._game, req, opts);
		}

		return gameRequest;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const gameRequest = this._simple(doc, req, opts);

		// creator
		if (this._populated(doc, '_created_by')) {
			gameRequest.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}

		return gameRequest;
	}
}

module.exports = new GameRequestSerializer();