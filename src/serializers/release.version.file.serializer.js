const _ = require('lodash');
const Serializer = require('./serializer');
const BuildSerializer = require('./build.serializer');
const FileSerializer = require('./file.serializer');
const UserSerializer = require('./user.serializer');

class ReleaseVersionFileSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const versionFile = _.pick(doc, ['flavor', 'validation', 'released_at', 'counter']);

		// file
		versionFile.file = FileSerializer.simple(doc._file, req, opts);

		// compat
		versionFile.compatibility = doc._compatibility.map(build => BuildSerializer.reduced(build, req, opts));

		// media
		versionFile.playfield_image = FileSerializer.simple(doc._playfield_image, req, opts);
		if (doc._playfield_video) {
			versionFile.playfield_video = FileSerializer.simple(doc._playfield_video, req, opts);
		}

		// validator
		if (doc.validation) {
			if (doc.populated('validation._validated_by')) {
				versionFile.validation.validated_by = UserSerializer.reduced(doc.validation._validated_by, req, opts);
			}
			delete versionFile.validation._validated_by;
		}

		// thumb
		if (opts.thumbPerFile && opts.thumbFormat) {
			versionFile.thumb = this._getFileThumb(doc, opts);
		}

		return versionFile;
	}
}

module.exports = new ReleaseVersionFileSerializer();
