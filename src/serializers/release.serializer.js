const _ = require('lodash');
const Serializer = require('./serializer');
const GameSerializer = require('./game.serializer');
const UserSerializer = require('./user.serializer');

class ReleaseSerializer extends Serializer {

	simple(object, req, opts) {

		const release = _.pick(object, ['id', 'name', 'created_at', 'released_at', 'counter']);

		release.game = GameSerializer.reduced(object._game, req, opts);
		release.authors = object.authors.map(author => {
			return { user: UserSerializer.reduced(author._user, req, opts), roles: author.roles };
		});
		// 'authors', 'versions'

		return release;
	}

	detailed(object, req, opts) {

	}

}

module.exports = new ReleaseSerializer();