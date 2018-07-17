/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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
import { filter, isArray, isEqual, keys, map, uniq } from 'lodash';
import { PrettyIdModel, Schema, Types } from 'mongoose';

import { fileReferencePlugin } from '../../common/mongoose/file.reference.plugin';
import { prettyIdPlugin } from '../../common/mongoose/pretty.id.plugin';
import { state } from '../../state';
import { ReleaseDocument } from '../release.doument';
import { ReleaseFileFlavor, ReleaseVersionFileDocument } from './file/release.version.file.document';
import { releaseVersionFileFields, releaseVersionFileSchema } from './file/release.version.file.schema';
import { ReleaseVersion } from './release.version';
import { ReleaseVersionDocument } from './release.version.document';

export const releaseVersionFields = {
	version: { type: String, required: 'Version must be provided.' },
	released_at: { type: Date, required: true },
	changes: { type: String },
	files: {
		validate: { validator: nonEmptyArray, message: 'You must provide at least one file.' },
		type: [releaseVersionFileSchema],
		index: true,
	},
	counter: {
		downloads: { type: Number, default: 0 },
		comments: { type: Number, default: 0 },
	},
};

export interface ReleaseVersionModel extends PrettyIdModel<ReleaseVersionDocument> {}
export const releaseVersionSchema = new Schema(releaseVersionFields, { toObject: { virtuals: true, versionKey: false } });

releaseVersionSchema.plugin(fileReferencePlugin);
releaseVersionSchema.plugin(prettyIdPlugin, { model: 'ReleaseVersion' });

/**
 * Validates files.
 *
 * Note that individual files cannot be updated; they can only be added or
 * removed. Thus, we base the file index (i) on new items only.
 */
releaseVersionSchema.path('files').validate(async function(files: ReleaseVersionFileDocument[]) {

	// ignore if no files set
	if (!isArray(files) || files.length === 0) {
		return Promise.resolve(true);
	}

	let hasTableFile = false;
	const tableFiles: Array<{ file: ReleaseVersionFileDocument, index: number }> = [];

	let index = 0; // when updating a version, ignore existing files, so increment only if new
	for (const f of files) {
		const isTableFile = await validateFile(this, f, index);
		if (isTableFile) {
			hasTableFile = true;
			tableFiles.push({ file: f, index });
		}
		if (f.isNew) {
			index++;
		}
	}

	if (!hasTableFile) {
		this.invalidate('files', 'At least one table file must be provided.');
	}

	// can be either exploded into object or id only.
	const getIdFromFile = (file: any) => file._id ? file._id.toString() : file.toString();

	//console.log('Checking %d table files for compat/flavor dupes:', _.keys(tableFiles).length);

	// validate existing compat/flavor combination
	tableFiles.forEach(tableFile => {
		const f = tableFile.file;

		if (!f.flavor || !f._compatibility) {
			return;
		}

		const fileFlavor = (f.flavor as any).toObject();
		const fileCompat = map(f._compatibility, getIdFromFile);
		fileCompat.sort();

		const dupeFiles = filter(map(tableFiles, 'file'), otherFile => {

			if (f.id === otherFile.id) {
				return false;
			}
			const compat = map(otherFile._compatibility, getIdFromFile);
			compat.sort();

			// console.log('  File %s <-> %s', file.id, otherFile.id);
			// console.log('     compat %j <-> %j', fileCompat, compat);
			// console.log('     flavor %j <-> %j', fileFlavor, otherFile.flavor.toObject());

			return isEqual(fileCompat, compat) && isEqual(fileFlavor, (otherFile.flavor as any).toObject());
		});

		if (f.isNew && dupeFiles.length > 0) {
			// console.log('     === FAILED ===');
			this.invalidate('files.' + tableFile.index + '._compatibility', 'A combination of compatibility and flavor already exists with the same values.');
			this.invalidate('files.' + tableFile.index + '.flavor', 'A combination of compatibility and flavor already exists with the same values.');
		}
	});
	return true;

});

/**
 * Validates the given file.
 *
 * @param release Where to apply the invalidations to
 * @param tableFile File to validate
 * @param {int} index Index of the file in the request body
 * @returns {Promise<boolean>} Promise resolving in true if the file was a table file or false otherwise
 */
async function validateFile(release: ReleaseDocument, tableFile: ReleaseVersionFileDocument, index: number): Promise<boolean> {

	if (!tableFile._file) {
		return Promise.resolve(false);
	}

	const f = await state.models.File.findById(tableFile._file).exec();

	// will fail by reference plugin
	if (!f) {
		return false;
	}

	// don't care about anything else but table files
	if (f.getMimeCategory() !== 'table') {
		return false;
	}

	// flavor
	const fileFlavor: ReleaseFileFlavor = tableFile.flavor || {};
	keys(releaseVersionFileFields.flavor).forEach(flavor => {
		if (!fileFlavor[flavor]) {
			release.invalidate('files.' + index + '.flavor.' + flavor, 'Flavor `' + flavor + '` must be provided.', fileFlavor[flavor]);
		}
	});

	// validate compatibility (in here because it applies only to table files.)
	if (!isArray(tableFile._compatibility) || !tableFile._compatibility.length) {
		// TODO check if exists.
		release.invalidate('files.' + index + '._compatibility', 'At least one build must be provided.', tableFile._compatibility);
	} else if (tableFile._compatibility.length !== uniq((tableFile._compatibility as Types.ObjectId[]).map(c => c.toString())).length) {
		release.invalidate('files.' + index + '._compatibility', 'Cannot link a build multiple times.', tableFile._compatibility);
	}

	// check if playfield image exists
	if (!tableFile._playfield_image) {
		release.invalidate('files.' + index + '._playfield_image', 'Playfield image must be provided.', tableFile._playfield_image);
	}

	const mediaValidations: Array<Promise<void>> = [];

	// validate playfield image
	if (tableFile._playfield_image) {
		mediaValidations.push(state.models.File.findById(tableFile._playfield_image).exec().then(playfieldImage => {
			if (!playfieldImage) {
				release.invalidate('files.' + index + '._playfield_image',
					'Playfield "' + tableFile._playfield_image + '" does not exist.', tableFile._playfield_image);
				return;
			}

			// validate aspect ratio
			const ar = playfieldImage.metadata.size.width / playfieldImage.metadata.size.height;

			if (ar > 1 && (ar < 1.5 || ar > 1.85)) {
				release.invalidate('files.' + index + '._playfield_image',
					'Playfield image must have an aspect ratio between 16:9 and 16:10.', tableFile._playfield_image);
			}
			if (ar < 1 && ((1 / ar) < 1.5 || (1 / ar) > 1.85)) {
				release.invalidate('files.' + index + '._playfield_image',
					'Playfield image must have an aspect ratio between 16:9 and 16:10.', tableFile._playfield_image);
			}

			if (playfieldImage.file_type === 'playfield') {
				release.invalidate('files.' + index + '._playfield_image',
					'Either provide rotation parameters in query or use "playfield-fs" or "playfield-ws" in file_type.', tableFile._playfield_image);

			} else if (!['playfield-fs', 'playfield-ws'].includes(playfieldImage.file_type)) {
				release.invalidate('files.' + index + '._playfield_image',
					'Must reference a file with file_type "playfield-fs" or "playfield-ws".', tableFile._playfield_image);

			} else {

				// fail if table file is set to FS but provided playfield is not
				if (fileFlavor.orientation && fileFlavor.orientation === 'fs' && playfieldImage.file_type !== 'playfield-fs') {
					release.invalidate('files.' + index + '._playfield_image', 'Table file orientation is set ' +
						'to FS but playfield image is "' + playfieldImage.file_type + '".', tableFile._playfield_image);
				}

				// fail if table file is set to WS but provided playfield is not
				if (fileFlavor.orientation && fileFlavor.orientation === 'ws' && playfieldImage.file_type !== 'playfield-ws') {
					release.invalidate('files.' + index + '._playfield_image', 'Table file orientation is set ' +
						'to WS but playfield image is "' + playfieldImage.file_type + '".', tableFile._playfield_image);
				}

				// fail if playfield is set to FS but file's metadata say otherwise
				if (playfieldImage.file_type === 'playfield-fs' && playfieldImage.metadata.size.width > playfieldImage.metadata.size.height) {
					release.invalidate('files.' + index + '._playfield_image', 'Provided playfield "' + playfieldImage.id + '" is ' +
						playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
						' (landscape) when it really should be portrait.', tableFile._playfield_image);
				}

				// fail if playfield is set to WS but file's metadata say otherwise
				if (playfieldImage.file_type === 'playfield-ws' && playfieldImage.metadata.size.width < playfieldImage.metadata.size.height) {
					release.invalidate('files.' + index + '._playfield_image', 'Provided playfield "' + playfieldImage.id + '" is ' +
						playfieldImage.metadata.size.width + 'x' + playfieldImage.metadata.size.height +
						' (portrait) when it really should be landscape.', tableFile._playfield_image);
				}
			}
		}));
	}

	// TODO validate playfield video

	await Promise.all(mediaValidations);
	return true;
}

function nonEmptyArray(value: any[]) {
	return isArray(value) && value.length > 0;
}

releaseVersionSchema.methods.getFileIds = function(this: ReleaseVersionDocument, files?: ReleaseVersionFileDocument[]): string[] {
	return ReleaseVersion.getFileIds(this, files);
};

releaseVersionSchema.methods.getPlayfieldImageIds = function(this: ReleaseVersionDocument): string[] {
	return ReleaseVersion.getPlayfieldImageIds(this.files);
};
