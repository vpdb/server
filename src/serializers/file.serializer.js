const _ = require('lodash');
const Serializer = require('./serializer');

class FileSerializer extends Serializer {

	simple(object, req, opts) {
		return _.pick(object, ['id', 'name', 'bytes', 'mime_type']);
	}
}

module.exports = new FileSerializer();