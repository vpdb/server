const _ = require('lodash');
const Serializer = require('./serializer');

class BuildSerializer extends Serializer {

	reduced(object, req, opts) {
		return _.pick(object, ['id']);
	}

	simple(object, req, opts) {
		return object;
	}
}

module.exports = new BuildSerializer();