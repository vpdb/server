/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

'use strict';

const fs = require('fs');
const mongoose = require('mongoose');
const File = mongoose.model('File');

const storage = require('../modules/storage');

// bootstrap processor
const processors = {
	directb2s: require('../modules/processor/directb2s')
};
const variations = {
	directb2s: processors.directb2s.variations
};

module.exports.up = function() {

	return File.find({ mime_type: 'application/x-directb2s'}).exec().then(files => Promise.each(files, file => {

		const mimeCategory = file.getMimeCategory();
		const processor = processors[mimeCategory];

		if (!processor) {
			return;
		}
		console.log('Processing %s...', file.name);

		// process pass 1
		if (variations[mimeCategory] && variations[mimeCategory][file.file_type]) {

			return Promise.each(variations[mimeCategory][file.file_type], variation => {
				let original = file.getPath(variation);
				let dest = file.getPath(variation, '_reprocessing');
				console.log('   -> %s: %s', variation.name, dest);
				return processor.pass1(file.getPath(), dest, file, variation).then(() => {
					if (fs.existsSync(original)) {
						fs.unlinkSync(original);
					}
					fs.renameSync(dest, original);
				})
				.then(() => storage.onProcessed(file, variation, processor))
				.catch(err => console.log('ERROR: %s', err.message));
			});
		}

	})).then(() => {
		console.log('All DirectB2S backglasses processed.');
	});
};