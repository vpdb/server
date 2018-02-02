const _ = require('lodash');
const Serializer = require('./serializer');

class UserSerializer extends Serializer {

	/** @protected */
	_reduced(object, req, opts) {
		return _.pick(object, ['id', 'name', 'username', 'thumb', 'gravatar_id', 'location' ]);
	}

	/** @protected */
	_simple(object, req, opts) {
		const user = this._reduced(object, req, opts);

		return user;
	}

}

module.exports = new UserSerializer();