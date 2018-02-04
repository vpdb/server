const _ = require('lodash');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');

class BackglassVersionSerializer extends Serializer {

	/** @private */
	_reduced(doc, req, opts) {
		const backglassVersion = _.pick(doc, [ 'version', 'changes', 'released_at', 'counter' ]);
		if (doc.populated('_file')) {
			backglassVersion.file = FileSerializer.reduced(doc._file, req, opts);
		}
		return backglassVersion;
	}

	/** @private */
	_simple(doc, req, opts) {
		const backglassVersion = _.pick(doc, [ 'version', 'changes', 'released_at', 'counter' ]);
		if (doc.populated('_file')) {
			backglassVersion.file = FileSerializer.simple(doc._file, req, opts);
		}
		return backglassVersion;
	}
}

module.exports = new BackglassVersionSerializer();