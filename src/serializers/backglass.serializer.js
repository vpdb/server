const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const AuthorSerializer = require('./author.serializer');
const UserSerializer = require('./user.serializer');
const BackglassVersionSerializer = require('./backglass.version.serializer');

class BackglassSerializer extends Serializer {

	/** @protected */
	_reduced(object, req, opts) {
		return this._serialize(object, req, opts, BackglassVersionSerializer.reduced.bind(BackglassVersionSerializer));
	}

	/** @protected */
	_simple(object, req, opts) {
		return this._serialize(object, req, opts, BackglassVersionSerializer.simple.bind(BackglassVersionSerializer));
	}

	/** @protected */
	_detailed(object, req, opts) {
		const backglass = this._serialize(object, req, opts, BackglassVersionSerializer.simple.bind(BackglassVersionSerializer));

		// creator
		backglass.created_by = UserSerializer.reduced(object._created_by, req, opts);

		return backglass;
	}

	/** @private */
	_serialize(object, req, opts, backglassSerializer) {
		// primitive fields
		const backglass = _.pick(object, ['id', 'description', 'acknowledgements', 'created_at']);

		// versions
		backglass.versions = object.versions.map(bg => backglassSerializer(bg, req, opts));

		// game
		backglass.game = GameSerializer.reduced(object._game, req, opts);

		// authors
		backglass.authors = object.authors.map(author => AuthorSerializer.reduced(author, req, opts));

		return backglass;
	}
}

module.exports = new BackglassSerializer();