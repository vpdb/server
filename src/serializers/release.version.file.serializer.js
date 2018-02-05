const _ = require('lodash');
const Serializer = require('./serializer');
const BuildSerializer = require('./build.serializer');
const FileSerializer = require('./file.serializer');
const UserSerializer = require('./user.serializer');

class ReleaseVersionFileSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, BuildSerializer.reduced.bind(BuildSerializer), FileSerializer.simple.bind(FileSerializer));
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const versionFile = this._serialize(doc, req, opts, BuildSerializer.simple.bind(BuildSerializer), FileSerializer.detailed.bind(FileSerializer));

		// media
		if (this._populated(doc, '_playfield_image')) {
			versionFile.playfield_image = FileSerializer.detailed(doc._playfield_image, req, opts);
		}
		if (doc._playfield_video && this._populated(doc, '_playfield_video')) {
			versionFile.playfield_video = FileSerializer.detailed(doc._playfield_video, req, opts);
		}

		return versionFile;
	}

	/** @protected */
	_serialize(doc, req, opts, buildSerializer, fileSerializer) {
		const versionFile = {
			flavor: doc.flavor.toObject(),
			counter: doc.counter.toObject(),
			released_at: doc.released_at
		};

		// file
		if (this._populated(doc, '_file')) {
			versionFile.file = fileSerializer(doc._file, req, opts);
		}

		// compat
		if (this._populated(doc, '_compatibility')) {
			versionFile.compatibility = doc._compatibility.map(build => buildSerializer(build, req, opts));
		}

		// validation
		if (doc.validation && doc.validation.status) {
			versionFile.validation = {
				status: doc.validation.status,
				message: doc.validation.message,
				validated_at: doc.validation.validated_at,
				validated_by: this._populated(doc, 'validation._validated_by') ? UserSerializer.reduced(doc.validation._validated_by, req, opts) : undefined
			};
		}

		// thumb
		if (opts.thumbPerFile && opts.thumbFormat) {
			versionFile.thumb = this._getFileThumb(doc, req, opts);
		}

		return versionFile;
	}
}

module.exports = new ReleaseVersionFileSerializer();
