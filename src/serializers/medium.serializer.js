const _ = require('lodash');
const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');
const GameSerializer = require('./release.serializer');
const ReleaseSerializer = require('./release.serializer');
const FileSerializer = require('./file.serializer');

class MediumSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const medium = _.pick(doc, ['id', 'file', 'game', 'release', 'category', 'description', 'acknowledgements', 'created_at', 'created_by']);
		if (doc.populated('_file')) {
			medium.file = FileSerializer.simple(doc._file, req, opts);
		}
		if (doc.populated('_created_by')) {
			medium.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}
		if (doc.populated('_ref.game')) {
			medium.game = GameSerializer.simple(doc._ref.game, req, opts);
		}
		if (doc.populated('_ref.release')) {
			medium.release = ReleaseSerializer.simple(doc._ref.release, req, opts);
		}
		return medium;
	}
}

module.exports = new MediumSerializer();
