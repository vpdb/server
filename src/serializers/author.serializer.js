const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');

class AuthorSerializer extends Serializer {

	/** @protected */
	_reduced(object, req, opts) {
		return {
			user: UserSerializer.reduced(object._user, req, opts),
			roles: object.roles
		};
	}

	/** @protected */
	_simple(object, req, opts) {
		return {
			user: UserSerializer.simple(object._user, req, opts),
			roles: object.roles
		};
	}

}

module.exports = new AuthorSerializer();