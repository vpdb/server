const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');

class AuthorSerializer extends Serializer {

	reduced(object, req, opts) {
		return {
			user: UserSerializer.reduced(object._user, req, opts),
			roles: object.roles
		};
	}

	simple(object, req, opts) {
		return {
			user: UserSerializer.simple(object._user, req, opts),
			roles: object.roles
		};
	}

}

module.exports = new AuthorSerializer();