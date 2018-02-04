const _ = require('lodash');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');
const UserSerializer = require('./user.serializer');

class RomSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		const rom = _.pick(doc, ['id', 'version', 'notes', 'languages', 'rom_files']);

		// file
		if (doc.populated('_file')) {
			rom.file = FileSerializer.simple(doc._file, req, opts);
		}

		// creator
		if (doc.populated('_created_by')) {
			rom.created_by = UserSerializer.reduced(doc._created_by, req, opts);
		}

		return rom;
	}
}

module.exports = new RomSerializer();