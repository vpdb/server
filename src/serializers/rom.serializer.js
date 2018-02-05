const _ = require('lodash');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');
const UserSerializer = require('./user.serializer');

class RomSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const rom = _.pick(doc, ['id', 'version', 'notes', 'languages']);

		rom.rom_files = doc.rom_files.toObject().map(f => _.pick(f, ['filename', 'bytes', 'crc', 'modified_at']));

		// file
		if (this._populated(doc, '_file')) {
			rom.file = FileSerializer.simple(doc._file, req, opts);
		}

		// creator
		if (this._populated(doc, '_created_by')) {
			rom.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}

		return rom;
	}
}

module.exports = new RomSerializer();