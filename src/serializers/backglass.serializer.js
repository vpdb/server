const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const AuthorSerializer = require('./author.serializer');
const UserSerializer = require('./user.serializer');
const BackglassVersionSerializer = require('./backglass.version.serializer');

class BackglassSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return this._serialize(doc, req, opts, BackglassVersionSerializer.reduced.bind(BackglassVersionSerializer));
	}

	/** @protected */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, BackglassVersionSerializer.simple.bind(BackglassVersionSerializer));
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const backglass = this._serialize(doc, req, opts, BackglassVersionSerializer.simple.bind(BackglassVersionSerializer));

		// creator
		if (doc.populated('_created_by')) {
			backglass.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}

		return backglass;
	}

	/** @private */
	_serialize(doc, req, opts, versionSerializer) {
		// primitive fields
		const backglass = _.pick(doc, ['id', 'description', 'acknowledgements', 'created_at']);

		// versions
		backglass.versions = doc.versions.map(version => versionSerializer(version, req, opts));

		// game
		if (doc.populated('_game')) {
			backglass.game = GameSerializer.reduced(doc._game, req, opts);
		}

		// authors
		backglass.authors = doc.authors.map(author => AuthorSerializer.reduced(author, req, opts));

		return backglass;
	}
}

module.exports = new BackglassSerializer();