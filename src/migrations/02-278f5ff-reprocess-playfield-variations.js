'use strict';

const fs = require('fs');
const rimraf = Promise.promisify(require('rimraf'));
const mongoose = require('mongoose');

const File = mongoose.model('File');

const storage = require('../modules/storage');
const config = require('../modules/settings').current;

// bootstrap processors
const processors = {
	image: require('../modules/processor/image'),
	video: require('../modules/processor/video'),
	table: require('../modules/processor/table'),
	archive: require('../modules/processor/archive')
};
const variations = {
	image: processors.image.variations,
	video: processors.video.variations,
	table: processors.table.variations
};

module.exports.up = function(grunt) {

	let query = { $or: [
		{ file_type: 'playfield-fs' },
		{ file_type: 'playfield-ws' }
	] };
	return Promise.each(File.find(query).exec(), file => {

		const mimeCategory = file.getMimeCategory();
		const processor = processors[mimeCategory];

		if (!processor) {
			return;
		}

		grunt.log.writeln('Processing %s %s %s - %s...', file.file_type, processor.name, file.id, file.name);

		// update metadata
		return processor.metadata(file).then(metadata => {
			File.sanitizeObject(metadata);
			file.metadata = metadata;
			file.variations = {};
			return file.save();

		}).then(() => {

			// process pass 1
			if (variations[mimeCategory] && variations[mimeCategory][file.file_type]) {

				return Promise.each(variations[mimeCategory][file.file_type], variation => {
					let original = file.getPath(variation);
					let dest = file.getPath(variation, '_reprocessing');
					grunt.log.writeln('   -> %s: %s', variation.name, dest);
					return processor.pass1(file.getPath(), dest, file, variation).then(() => {
						if (fs.existsSync(original)) {
							fs.unlinkSync(original);
						}
						fs.renameSync(dest, original);
					})
					.then(() => storage.onProcessed(file, variation, processor))
					.catch(err => console.error('ERROR: %s', err.message));
				});
			}
		});
	}).then(() => {

		// delete folders "medium-landscape" and "medium-landscape-2x"
		return Promise.each([
			config.vpdb.storage.public.path + '/medium-landscape',
			config.vpdb.storage.public.path + '/medium-landscape-2x',
			config.vpdb.storage.protected.path + '/medium-landscape',
			config.vpdb.storage.protected.path + '/medium-landscape-2x'
		], folder => {
			if (fs.existsSync(folder)) {
				grunt.log.writeln('Deleting folder "%s"...', folder);
				return rimraf(folder);
			} else {
				grunt.log.writeln('Skipping folder "%s"...', folder);
			}
		});
	});
};