const _ = require('lodash');
const quota = require('../modules/quota');
const storage = require('../modules/storage');
const Serializer = require('./serializer');

class FileSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return _.pick(doc, ['id', 'name', 'bytes', 'mime_type']);
	}

	/** @protected */
	_simple(doc, req, opts) {
		const file = this._reduced(doc, req, opts);
		_.assign(file, _.pick(doc, [ 'bytes', 'counter' ]));
		file.variations = storage.urls(doc);
		file.cost = quota.getCost(doc);
		file.url = storage.url(doc);
		file.is_protected = !doc.is_active || file.cost > -1;
		return file;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const file = this._simple(doc, req, opts);
		_.assign(file, _.pick(doc, ['created_at', 'file_type', 'metadata']));
		file.metadata = storage.metadataShort(doc);
		return file;
	}
}

module.exports = new FileSerializer();