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

import { resolve } from 'path';
import { Schema } from 'mongoose';
import { includes } from 'lodash';

import { state } from '../state';
import { quota } from '../common/quota';
import { storage } from '../common/storage';
import { config, settings } from '../common/settings';
import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { mimeTypeNames, mimeTypes } from './file.mimetypes';
import { File, FilePathOptions} from './file';
import { fileTypes } from './file.types';
import { FileVariation } from './file.variations';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const fileFields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, required: 'Filename must be provided.' },
	bytes: { type: Number, required: true },
	mime_type: {
		type: String,
		required: true,
		'enum': {
			values: mimeTypeNames,
			message: 'Invalid MIME type. Valid MIME types are: ["' + mimeTypeNames.join('", "') + '"].'
		}
	},
	file_type: {
		type: String,
		required: true,
		'enum': {
			values: fileTypes.names,
			message: 'Invalid file type. Valid file types are: ["' + fileTypes.names.join('", "') + '"].'
		}
	},
	metadata: { type: Schema.Types.Mixed },
	variations: { type: Schema.Types.Mixed },
	preprocessed: { type: Schema.Types.Mixed },
	is_active: { type: Boolean, required: true, 'default': false },
	counter: { downloads: { type: Number, 'default': 0 } },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' }
};

export const fileSchema = new Schema(fileFields, { toObject: { virtuals: true, versionKey: false } });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------

fileSchema.plugin(metricsPlugin);


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------

fileSchema.path('mime_type').validate(function (mimeType: string) {
	// will be validated by enum
	if (!this.file_type || !fileTypes.exists(this.file_type)) {
		return true;
	}
	if (!includes(fileTypes.getMimeTypes(this.file_type), mimeType)) {
		this.invalidate('mime_type', 'Invalid MIME type "' + mimeType + '" for file type "' + this.file_type + '". Valid MIME types are: ["' + fileTypes.getMimeTypes(this.file_type).join('", "') + '"].');
	}
});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Returns the local path where the file is stored.
 *
 * Note that this is to *construct* the file name, and doesn't mean that the
 * file actually exists at the given location.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @param {FilePathOptions} opts Path options
 * @return {string} Absolute path to storage
 */
fileSchema.methods.getPath = function (variation: FileVariation = null, opts: FilePathOptions = {}): string {
	const baseDir = this.isPublic(variation) && !opts.forceProtected ? config.vpdb.storage.public.path : config.vpdb.storage.protected.path;
	const suffix = opts.tmpSuffix || '';
	return variation ?
		resolve(baseDir, variation.name, this.id) + suffix + this.getExt(variation) :
		resolve(baseDir, this.id) + suffix + this.getExt(variation);
};

/**
 * Returns the file extension, inclusively the dot.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string} File extension
 */
fileSchema.methods.getExt = function (variation: FileVariation = null): string {
	return '.' + mimeTypes[this.getMimeType(variation)].ext;
};

/**
 * Returns the public URL of the file.
 *
 * Note that the URL can change whether the file is protected or not.
 * Typically a release file is protected during release upload and becomes
 * public only after submission.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string}
 */
fileSchema.methods.getUrl = function (variation: FileVariation = null): string {
	let storageUri = this.isPublic(variation) ? settings.storagePublicUri.bind(settings) : settings.storageProtectedUri.bind(settings);
	return variation ?
		storageUri('/files/' + variation.name + '/' + this.id + this.getExt(variation)) :
		storageUri('/files/' + this.id + this.getExt(variation));
};

/**
 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {boolean}
 */
fileSchema.methods.isPublic = function (variation: FileVariation = null): boolean {
	return this.is_active && quota.getCost(this, variation) === -1;
};

/**
 *  Returns true if the file is free (as in doesn't cost any credit), false otherwise.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {boolean} True if free, false otherwise.
 */
fileSchema.methods.isFree = function (variation: FileVariation = null): boolean {
	return quota.getCost(this, variation) <= 0;
};

/**
 * Returns the MIME type for a given variation (or for the main file if not specified).
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string} MIME type of the file or its variation.
 */
fileSchema.methods.getMimeType = function (variation?: FileVariation): string {
	if (variation && this.variations && this.variations[variation.name] && this.variations[variation.name].mime_type) {
		return this.variations[variation.name].mime_type;

	} else if (variation && variation.mimeType) {
		return variation.mimeType;

	} else {
		return this.mime_type;
	}
};

/**
 * Returns the "primary" type (the part before the `/`) of the mime type.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string} Primary part of the MIME type.
 */
fileSchema.methods.getMimeTypePrimary = function (variation: FileVariation = null): string {
	return this.getMimeType(variation).split('/')[0];
};

/**
 * Returns the sub type (the part after the `/`) of the mime type.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string} Secondary part of the MIME type.
 */
fileSchema.methods.getMimeSubtype = function (variation: FileVariation = null): string {
	return this.getMimeType(variation).split('/')[1];
};

/**
 * Returns the file category.
 *
 * @param {FileVariation} [variation] File variation or null for original file
 * @return {string}
 */
fileSchema.methods.getMimeCategory = function (variation: FileVariation = null): string {
	return mimeTypes[this.getMimeType(variation)].category;
};

/**
 * Returns something useful for logging.
 * @param {object|string} variation Variation name or whole object
 * @returns {string}
 */
fileSchema.methods.toString = function (variation: FileVariation = null): string {
	return this.file_type + ' "' + this.id + '"' + (variation ? ' (' + variation.name + ')' : '');
};

/**
 * Switches a files from inactive to active and moves it to the public folder if necessary.
 *
 * @return {Promise<File>} Moved file
 */
fileSchema.methods.switchToActive = async function (): Promise<File> {
	await state.models.File.update({ _id: this._id }, { is_active: true });
	this.is_active = true;
	return await storage.switchToPublic(this);
};

/**
 * Returns all variations that are stored in the database for this file.
 *
 * @returns {FileVariation[]} Existing variations
 */
fileSchema.methods.getExistingVariations = function (): FileVariation[] {
	const variations:FileVariation[] = [];
	if (!this.variations) {
		return [];
	}
	for (let name of Object.keys(this.variations)) {
		variations.push({ name: name, mimeType: this.variations[name].mime_type });
	}
	return variations;
};


/**
 * Locks a file as being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
// FileSchema.methods.lock = function (variation) {
// 	const lockfile = this.getLockFile(variation);
// 	logger.debug('[file] Locking file at "%s"', lockfile);
// 	try {
// 		fs.closeSync(fs.openSync(lockfile, 'w'));
// 	} catch (err) {
// 		logger.error('[file] Error creating lock file at "%s": %s', lockfile, err.message);
// 	}
// };

/**
 * Unlocks a file from being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
// FileSchema.methods.unlock = function (variation) {
// 	const lockfile = this.getLockFile(variation);
// 	logger.debug('[file] Unlocking file at "%s"', lockfile);
// 	try {
// 		fs.unlinkSync(lockfile);
// 	} catch (err) {
// 		logger.error('[file] Error deleting lock file: %s', err.message);
// 	}
// };

/**
 * Unlocks a file from being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
// FileSchema.methods.isLocked = function (variation) {
// 	const lockfile = this.getLockFile(variation);
// 	return fs.existsSync(lockfile);
// };

/**
 * Returns the path of the lock file.
 *
 * Lock files indicate that the file is being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 * @returns {string}                  Lockfile
 */
// FileSchema.methods.getLockFile = function (variation) {
// 	return storage.path(this, variation, { lockFile: true });
// };


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

/**
 * A helper method that replaces the "$" and "." character in order to be able
 * to store non-structured objects in MongoDB.
 *
 * @param {object} object Object that is going to end up in MongoDB
 * @param {string} [replacement=-] (optional) Replacement character
 */
fileSchema.statics.sanitizeObject = function (object:any, replacement='-') {
	let oldProp;
	for (let property in object) {
		if (object.hasOwnProperty(property)) {
			if (/\.|\$/.test(property)) {
				oldProp = property;
				property = oldProp.replace(/\.|\$/g, replacement);
				object[property] = object[oldProp];
				delete object[oldProp];
			}
			if (typeof object[property] === 'object') {
				fileSchema.statics.sanitizeObject(object[property]);
			}
		}
	}
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
fileSchema.post('remove', async function (obj:File) {

		// remove physical file
		await storage.remove(obj);

		// remove table blocks
		await state.models.TableBlock.update(
			{ _files: obj._id },
			{ $pull: { _files: obj._id } },
			{ multi: true }
		);
		await state.models.TableBlock.remove({ _files: { $size: 0 } });
});
