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
		if (this._populated(doc, '_created_by')) {
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
		if (this._populated(doc, '_game')) {
			backglass.game = GameSerializer.reduced(doc._game, req, opts);
		}

		// authors
		if (this._populated(doc, 'authors._user')) {
			backglass.authors = doc.authors.map(author => AuthorSerializer.reduced(author, req, opts));
		}

		return backglass;
	}
}

module.exports = new BackglassSerializer();