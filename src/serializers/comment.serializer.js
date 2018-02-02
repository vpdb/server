const _ = require('lodash');
const Serializer = require('./serializer');
const UserSerializer = require('./user.serializer');
const ReleaseSerializer = require('./release.serializer');

class CommentSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const comment = _.pick(doc, ['id', 'message', 'release', 'created_at']);
		if (doc.populated('_from')) {
			comment.from = UserSerializer.reduced(doc._from, req, opts);
		}
		if (doc.populated('_ref.release')) {
			comment.release = ReleaseSerializer.reduced(doc._ref.release, req, opts);
		}
	}
}

module.exports = new CommentSerializer();
