const _ = require('lodash');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');

class BackglassVersionSerializer extends Serializer {

	/** @private */
	_reduced(object, req, opts) {
		const backglassVersion = _.pick(object, [ 'version', 'changes', 'released_at', 'counter' ]);
		backglassVersion.file = FileSerializer.reduced(object._file, req, opts);
		return backglassVersion;
	}

	/** @private */
	_simple(object, req, opts) {
		const backglassVersion = _.pick(object, [ 'version', 'changes', 'released_at', 'counter' ]);
		backglassVersion.file = FileSerializer.simple(object._file, req, opts);
		return backglassVersion;
	}
}

module.exports = new BackglassVersionSerializer();