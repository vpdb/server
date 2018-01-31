const _ = require('lodash');
const Serializer = require('./serializer');

class UserSerializer extends Serializer {

	reduced(object, req, opts) {
		return _.pick(object, ['id', 'name', 'username', 'thumb', 'gravatar_id', 'location']);
	}

	simple(object, req, opts) {
		const user = this.reduced(object, req, opts);

		return user;
	}

}

module.exports = new UserSerializer();