const _ = require('lodash');
const Serializer = require('../../src/common/serializer');
const UserSerializer = require('../../src/users/user.serializer');
const GameSerializer = require('./game.serializer');
const ReleaseSerializer = require('./release.serializer');
const FileSerializer = require('./file.serializer');

class MediumSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const medium = _.pick(doc, ['id', 'category', 'description', 'acknowledgements', 'created_at']);
		if (this._populated(doc, '_file')) {
			medium.file = FileSerializer.detailed(doc._file, req, opts);
		}
		if (this._populated(doc, '_created_by')) {
			medium.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}
		if (this._populated(doc, '_ref.game')) {
			medium.game = GameSerializer.simple(doc._ref.game, req, opts);
		}
		if (this._populated(doc, '_ref.release')) {
			medium.release = ReleaseSerializer.simple(doc._ref.release, req, opts);
		}
		return medium;
	}
}

module.exports = new MediumSerializer();
