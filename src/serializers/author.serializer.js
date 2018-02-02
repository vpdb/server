const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');

class AuthorSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return {
			user: UserSerializer.reduced(doc._user, req, opts),
			roles: doc.roles
		};
	}

	/** @protected */
	_simple(doc, req, opts) {
		return {
			user: UserSerializer.simple(doc._user, req, opts),
			roles: doc.roles
		};
	}

}

module.exports = new AuthorSerializer();