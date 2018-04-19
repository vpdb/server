const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const FileSerializer = require('./file.serializer');

class BackglassVersionSerializer extends Serializer {

	/** @private */
	_reduced(doc, req, opts) {
		return this._serialize(doc, req, opts, FileSerializer.reduced.bind(FileSerializer));
	}

	/** @private */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, FileSerializer.simple.bind(FileSerializer));
	}

	_serialize(doc, req, opts, fileSerializer) {
		const backglassVersion = _.pick(doc, [ 'version', 'changes', 'released_at' ]);
		backglassVersion.counter = doc.counter.toObject();
		if (this._populated(doc, '_file')) {
			backglassVersion.file = fileSerializer(doc._file, req, opts);
		}
		return backglassVersion;
	}
}

module.exports = new BackglassVersionSerializer();