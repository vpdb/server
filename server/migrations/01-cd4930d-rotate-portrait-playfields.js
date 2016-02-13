"use strict";

const gm = require('gm');
const fs = require('fs');
const mongoose = require('mongoose');

const User = mongoose.model('User');
const File = mongoose.model('File');
const processor = require('../modules/processor/image');

module.exports.up = function(grunt) {

	return Promise.each(File.find({ file_type: 'playfield-fs' }).exec(), file => {

		if (!/^image\//i.test(file.mime_type)) {
			return;
		}

		if (file.metadata.size.width > file.metadata.size.height) {

			let original = file.getPath();
			let dest = file.getPath(null, '_reprocessing');

			let img = gm(original);
			img.rotate('black', -90);

			return new Promise((resolve, reject) => {
				let writeStream = fs.createWriteStream(dest);

				// setup success handler
				writeStream.on('finish', function() {
					grunt.log.writeln(file.name);
					resolve();
				});
				writeStream.on('error', reject);
				img.stream().on('error', reject).pipe(writeStream).on('error', reject);

			}).then(() => {
				if (fs.existsSync(original)) {
					fs.unlinkSync(original);
				}
				fs.renameSync(dest, original);

				return processor.metadata(file);

			}).then(metadata => {
				File.sanitizeObject(metadata);
				file.metadata = metadata;
				return file.save();

			}).catch(console.error);
		}
	});
};