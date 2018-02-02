const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const AuthorSerializer = require('./author.serializer');
const UserSerializer = require('./user.serializer');
const BackglassVersionSerializer = require('./backglass.version.serializer');

class BackglassSerializer extends Serializer {

	reduced(object, req, opts) {
		return this._serialize(this.REDUCED, object, req, opts);
	}

	simple(object, req, opts) {
		return this._serialize(this.SIMPLE, object, req, opts);
	}

	detailed(object, req, opts) {
		const backglass = this._serialize(this.DETAILED, object, req, opts);

		// creator
		backglass.created_by = UserSerializer.reduced(object._created_by, req, opts);

		return backglass;
	}

	_serialize(detailLevel, object, req, opts) {
		// primitive fields
		const backglass = _.pick(object, ['id', 'description', 'acknowledgements', 'created_at']);

		// versions
		if (detailLevel === this.REDUCED) {
			backglass.versions = object.versions.map(bg => BackglassVersionSerializer.reduced(bg, req, opts));
		} else {
			backglass.versions = object.versions.map(bg => BackglassVersionSerializer.simple(bg, req, opts));
		}

		// game
		backglass.game = GameSerializer.reduced(object._game, req, opts);

		// authors
		backglass.authors = object.authors.map(author => AuthorSerializer.reduced(author));

		return backglass;
	}
}

module.exports = new BackglassSerializer();