const _ = require('lodash');
const Serializer = require('./serializer');

class GameSerializer extends Serializer {

	reduced(object, req, opts) {
		return _.pick(object, [ 'id', 'title', 'manufacturer', 'year' ]);
	}

	simple(object, req, opts) {
		return _.pick(object, [ 'id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type' ]);
	}

}

module.exports = new GameSerializer();