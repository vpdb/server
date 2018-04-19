const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const UserSerializer = require('../../src/users/user.serializer');
const ReleaseSerializer = require('./release.serializer');

class CommentSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const comment = _.pick(doc, ['id', 'message', 'created_at']);
		if (this._populated(doc, '_from')) {
			comment.from = UserSerializer.reduced(doc._from, req, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			comment.release = ReleaseSerializer.reduced(doc._ref.release, req, opts);
		}
		return comment;
	}
}

module.exports = new CommentSerializer();
