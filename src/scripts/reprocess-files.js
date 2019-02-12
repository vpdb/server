/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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
Promise = require('bluebird');

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const settings = require('../../src/common/settings');
const storage = require('../modules/storage');
const config = settings.current;

mongoose.Promise = Promise;

// bootstrap db connection
mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } } });

// bootstrap models
const modelsPath = path.resolve(__dirname, '../models');
fs.readdirSync(modelsPath).forEach(function(file) {
	if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
		require(modelsPath + '/' + file);
	}
});

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

const File = mongoose.model('File');

const args = process.argv.slice(2);
const query = _.isArray(args) && args.length ? { id: { $in: args } } : { variations: { $exists : true, $ne : null }};
console.log(query);

File.find(query).exec().then(files => Promise.each(files, file => {

	const mimeCategory = file.getMimeCategory();
	const processor = processors[mimeCategory];

	if (!processor) {
		return;
	}

	console.log('Processing %s %s %s - %s...', file.file_type, processor.name, file.id, file.name);

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
				console.log('   -> %s: %s', variation.name, dest);
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

})).then(() => {
	console.log('DONE!');

}).catch(err => {
	console.error('ERROR: %s', err);
	console.error(err.stack);

});