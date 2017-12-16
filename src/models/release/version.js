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

const _ = require('lodash');
const logger = require('winston');
const mongoose = require('mongoose');

const toObj = require('../plugins/to-object');
const fileRef = require('../plugins/file-ref');
const prettyId = require('../plugins/pretty-id');

const file = require('./file');

const Schema = mongoose.Schema;

const fields = {
	version: { type: String, required: 'Version must be provided.' },
	released_at: { type: Date, required: true },
	changes: { type: String },
	files: { validate: [ nonEmptyArray, 'You must provide at least one file.' ], type: [ file.schema ], index: true },
	counter: {
		downloads: { type: Number, 'default': 0 },
		comments:   { type: Number, 'default': 0 }
	}
};
const schema = new Schema(fields, { usePushEach: true });
schema.plugin(fileRef);
schema.plugin(prettyId, { model: 'ReleaseVersion' });
schema.plugin(toObj);

/**
 * Validates files.
 *
 * Note that individual files cannot be updated; they can only be added or
 * removed. Thus, we base the file index (i) on new items only.
 */
schema.path('files').validate(function(files, callback) {

	// ignore if no files set
	if (!_.isArray(files) || files.length === 0) {
		return Promise.resolve(true);
	}

	let hasTableFile = false;
	const tableFiles = [];
	return Promise.try(() => {

		let index = 0; // when updating a version, ignore existing files, so increment only if new
		return Promise.each(files, f => {
			return validateFile(this, f, index).then(isTableFile => {
				if (isTableFile) {
					hasTableFile = true;
					tableFiles.push({ file: f, index: index});
				}
				if (f.isNew) {
					index++;
				}
			});
		});

	}).then(() => {

		if (!hasTableFile) {
			this.invalidate('files', 'At least one table file must be provided.');
		}

		// can be either exploded into object or id only.
		const getIdFromFile = file => file._id ? file._id.toString() : file.toString();

		//console.log('Checking %d table files for compat/flavor dupes:', _.keys(tableFiles).length);

		// validate existing compat/flavor combination
		tableFiles.forEach(tableFile => {
			let f = tableFile.file;

			if (!f.flavor || !f._compatibility) {
				return;
			}

			const fileFlavor = f.flavor.toObject();
			const fileCompat = _.map(f._compatibility, getIdFromFile);
			fileCompat.sort();

			const dupeFiles = _.filter(_.map(tableFiles, 'file'), otherFile => {

				if (f.id === otherFile.id) {
					return false;
				}
				const compat = _.map(otherFile._compatibility, getIdFromFile);
				compat.sort();

				// console.log('  File %s <-> %s', file.id, otherFile.id);
				// console.log('     compat %j <-> %j', fileCompat, compat);
				// console.log('     flavor %j <-> %j', fileFlavor, otherFile.flavor.toObject());

				return _.isEqual(fileCompat, compat) && _.isEqual(fileFlavor, otherFile.flavor.toObject());
			});

			if (f.isNew && dupeFiles.length > 0) {
				// console.log('     === FAILED ===');
				this.invalidate('files.' + tableFile.index + '._compatibility', 'A combination of compatibility and flavor already exists with the same values.');
				this.invalidate('files.' + tableFile.index + '.flavor', 'A combination of compatibility and flavor already exists with the same values.');
			}
		});
		return null;

	}).then(() => {
		callback(true);

	}).catch(/* istanbul ignore next */ err => {
		logger.error('[model|release] Error validating files! %s', err.message);
		logger.error(err.stack);
		callback(false);
	});
});

/**
 * Validates the given file.
 *
 * @param release Where to apply the invalidations to
 * @param tableFile File to validate
 * @param {int} index Index of the file in the request body
 * @returns {Promise.<boolean>} Promise resolving in true if the file was a table file or false otherwise
 */
function validateFile(release, tableFile, index) {

	if (!tableFile._file) {
		return Promise.resolve(false);
	}

	return mongoose.model('File').findById(tableFile._file).then(f => {

		// will fail by reference plugin
		if (!f) {
			return false;
		}

		// don't care about anything else but table files
		if (f.getMimeCategory() !== 'table') {
			return false;
		}

		// flavor
		const fileFlavor = tableFile.flavor || {};
		_.each(file.fields.flavor, (obj, flavor) => {
			if (!fileFlavor[flavor]) {
				release.invalidate('files.' + index + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.');
			}
		});

		// validate compatibility (in here because it applies only to table files.)
		if (!_.isArray(tableFile._compatibility) || !tableFile._compatibility.length) {
			// TODO check if exists.
			release.invalidate('files.' + index + '._compatibility', 'At least one build must be provided.');
		} else if (tableFile._compatibility.length !== _.uniq(tableFile._compatibility.map(c => c.toString())).length) {
			release.invalidate('files.' + index + '._compatibility', 'Cannot link a build multiple times.');
		}

		// check if playfield image exists
		if (!tableFile._playfield_image) {
			release.invalidate('files.' + index + '._playfield_image', 'Playfield image must be provided.');
		}

		const mediaValidations = [];

		// validate playfield image
		if (tableFile._playfield_image) {
			mediaValidations.push(mongoose.model('File').findById(tableFile._playfield_image).then(playfieldImage => {
				if (!playfieldImage) {
					release.invalidate('files.' + index + '._playfield_image',
						'Playfield "' + tableFile._playfield_image + '" does not exist.');
					return;
				}

				// validate aspect ratio
				const ar = playfieldImage.metadata.size.width / playfieldImage.metadata.size.height;

				if (ar > 1 && (ar < 1.5 || ar > 1.85)) {
					release.invalidate('files.' + index + '._playfield_image',
						'Playfield image must have an aspect ratio between 16:9 and 16:10.');
				}
				if (ar < 1 && ((1 / ar) < 1.5 || (1 / ar) > 1.85)) {
					release.invalidate('files.' + index + '._playfield_image',
						'Playfield image must have an aspect ratio between 16:9 and 16:10.');
				}

				if (playfieldImage.file_type === 'playfield') {
					release.invalidate('files.' + index + '._playfield_image',
						'Either provide rotation parameters in query or use "playfield-fs" or "playfield-ws" in file_type.');

				} else if (!_.includes(['playfield-fs', 'playfield-ws'], playfieldImage.file_type)) {
					release.invalidate('files.' + index + '._playfield_image',
						'Must reference a file with file_type "playfield-fs" or "playfield-ws".');

				} else {

					// fail if table file is set to FS but provided playfield is not
					if (fileFlavor.orientation && fileFlavor.orientation === 'fs' && playfieldImage.file_type !== 'playfield-fs') {
						release.invalidate('files.' + index + '._playfield_image', 'Table file orientation is set ' +
							'to FS but playfield image is "' + playfieldImage.file_type + '".');
					}

					// fail if table file is set to WS but provided playfield is not
					if (fileFlavor.orientation && fileFlavor.orientation === 'ws' && playfieldImage.file_type !== 'playfield-ws') {
						release.invalidate('files.' + index + '._playfield_image', 'Table file orientation is set ' +
							'to WS but playfield image is "' + playfieldImage.file_type + '".');
					}

					// fail if playfield is set to FS but file's metadata say otherwise
					if (playfieldImage.file_type === 'playfield-fs' && playfieldImage.metadata.size.width > playfieldImage.metadata.size.height) {
						release.invalidate('files.' + index + '._playfield_image', 'Provided playfield "' + playfieldImage.id + '" is ' +
							playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
							' (landscape) when it really should be portrait.');
					}

					// fail if playfield is set to WS but file's metadata say otherwise
					if (playfieldImage.file_type === 'playfield-ws' && playfieldImage.metadata.size.width < playfieldImage.metadata.size.height) {
						release.invalidate('files.' + index + '._playfield_image', 'Provided playfield "' + playfieldImage.id + '" is ' +
							playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
							' (portrait) when it really should be landscape.');
					}
				}
			}));
		}

		// TODO validate playfield video
		if (tableFile._playfield_video) {
			mediaValidations.push(Promise.resolve(() => logger.log('TODO: Validate playfield video')));
		}

		return Promise.all(mediaValidations).then(() => true);
	});
}

function nonEmptyArray(value) {
	return _.isArray(value) && value.length > 0;
}

schema.methods.getFileIds = function(files) {
	files = files || this.files;
	let tableFileIds = _.map(files, '_file').map(file => file ? (file._id ? file._id.toString() : file.toString()) : null);
	let playfieldImageId = _.compact(_.map(files, '_playfield_image')).map(file => file._id ? file._id.toString() : file.toString());
	let playfieldVideoId = _.compact(_.map(files, '_playfield_video')).map(file => file._id ? file._id.toString() : file.toString());
	return _.compact(_.flatten([...tableFileIds, playfieldImageId, playfieldVideoId]));
};

schema.methods.getPlayfieldImageIds = function() {
	return _.compact(_.map(this.files, '_playfield_image')).map(file => file._id ? file._id.toString() : file.toString());
};

schema.options.toObject = {
	virtuals: true,
	transform: function(doc, version) {
		delete version.id;
		delete version._id;
	}
};

module.exports.fields = fields;
module.exports.schema = schema;