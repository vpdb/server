const _ = require('lodash');
const quota = require('../modules/quota');
const storage = require('../modules/storage');
const Serializer = require('./serializer');

class FileSerializer extends Serializer {

	reduced(object, req, opts) {
		return _.pick(object, ['id', 'name', 'bytes', 'mime_type']);
	}

	simple(object, req, opts) {
		const file = this.reduced(object, req, opts);
		_.assign(file, _.pick(object, [ 'bytes', 'variations', 'is_protected', 'counter' ]));
		file.cost = quota.getCost(object);
		file.url = storage.url(object);
		file.is_protected = !object.is_active || file.cost > -1;
		return file;
	}

	detailed(object, req, opts) {
		const file = this.simple(object, req, opts);
		_.assign(file, _.pick(object, ['created_at', 'file_type', 'metadata']));
		return file;
	}
}

module.exports = new FileSerializer();