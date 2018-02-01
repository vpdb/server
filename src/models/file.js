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
const fs = require('fs');
const logger = require('winston');
const mongoose = require('mongoose');
const shortId = require('shortid32');

const toObj = require('./plugins/to-object');
const metrics = require('./plugins/metrics');
const storage = require('../modules/storage');
const quota = require('../modules/quota');
const mimeTypes = require('../modules/mimetypes');
const fileTypes = require('../modules/filetypes');

const Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, required: 'Filename must be provided.' },
	bytes: { type: Number, required: true },
	mime_type: {
		type: String,
		required: true,
		'enum': {
			values: _.keys(mimeTypes),
			message: 'Invalid MIME type. Valid MIME types are: ["' + _.keys(mimeTypes).join('", "') + '"].'
		}
	},
	file_type: {
		type: String,
		required: true,
		'enum': {
			values: fileTypes.keys(),
			message: 'Invalid file type. Valid file types are: ["' + fileTypes.keys().join('", "') + '"].'
		}
	},
	metadata: { type: Schema.Types.Mixed },
	variations: { type: Schema.Types.Mixed },
	preprocessed: { type: Schema.Types.Mixed },
	is_active: { type: Boolean, required: true, 'default': false },
	counter: { downloads: { type: Number, 'default': 0 } },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.ObjectId, required: true, ref: 'User' }
};
const FileSchema = new Schema(fields, { usePushEach: true });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
FileSchema.plugin(toObj);
FileSchema.plugin(metrics);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
const apiFields = {
	simple: ['id', 'name', 'url', 'bytes', 'variations', 'is_protected', 'counter', 'cost'], // fields returned in references
	detailed: ['created_at', 'mime_type', 'file_type', 'metadata']
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
FileSchema.virtual('created_by')
	.get(function() {
		if (this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});

FileSchema.virtual('url')
	.get(function() {
		return storage.url(this);
	});

/**
 * how much credit it costs to download this file.
 *
 * -1 = public file
 *  0 = free file
 * >0 = non-free file
 */
FileSchema.virtual('cost')
	.get(function() {
		return quota.getCost(this);
	});

/**
 * `protected` means that the file is served only to logged users
 */
FileSchema.virtual('is_protected')
	.get(function() {
		return !this.is_active || this.cost > -1;
	});


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
FileSchema.path('mime_type').validate(function(mimeType) {
	// will be validated by enum
	if (!this.file_type || !fileTypes.exists(this.file_type)) {
		return true;
	}
	if (!_.includes(fileTypes.mimeTypes(this.file_type), mimeType)) {
		this.invalidate('mime_type', 'Invalid MIME type "' + mimeType + '" for file type "' + this.file_type + '". Valid MIME types are: ["' + fileTypes.mimeTypes(this.file_type).join('", "') + '"].');
	}
});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

FileSchema.methods.toSimple = function() {
	return FileSchema.statics.toSimple(this);
};
FileSchema.methods.toDetailed = function() {
	return FileSchema.statics.toDetailed(this);
};

/**
 * Returns the local path where the file is stored.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 *                                    Note that for non-standard (i.e. not equal file) variation mime types,
 *                                    the object is mandatory.
 * @param {string} [tmpSuffix=]       If set, this is suffixed to the file name before the extension.
 * @returns {string}                  Absolute path to file.
 * @api public
 */
FileSchema.methods.getPath = function(variation, tmpSuffix) {
	return storage.path(this, variation, { tmpSuffix: tmpSuffix });
};

/**
 * Returns the file extension, inclusively the dot.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name"
 * @returns {string} File extension
 */
FileSchema.methods.getExt = function(variation) {
	return '.' + mimeTypes[this.getMimeType(variation)].ext;
};

/**
 * Returns the public URL of the file.
 *
 * @param {Object|String} variation - Either variation name or object containing attribute "name"
 * @returns {string}
 * @api public
 */
FileSchema.methods.getUrl = function(variation) {
	return storage.url(this, variation);
};

/**
 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
 *
 * @param {Object|String} variation - Either variation name or object containing attribute "name"
 * @returns {boolean}
 * @api public
 */
FileSchema.methods.isPublic = function(variation) {
	return this.is_active && quota.getCost(this, variation) === -1;
};

/**
 * Returns true if the file is free (as in doesn't cost any credit), false otherwise. <p>
 *
 * @param {Object|String} variation - Either variation name or object containing attribute "name"
 * @returns {boolean}
 * @api public
 */
FileSchema.methods.isFree = function(variation) {
	return quota.getCost(this, variation) <= 0;
};

/**
 * Returns the MIME type for a given variation (or for the main file if not specified).
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name"
 * @returns {string}
 */
FileSchema.methods.getMimeType = function(variation) {
	const variationName = _.isObject(variation) ? variation.name : variation;
	if (variation && this.variations && this.variations[variationName] && this.variations[variationName].mime_type) {
		return this.variations[variationName].mime_type;
	} else if (_.isObject(variation) && variation.mimeType) {
		return variation.mimeType;
	} else {
		return this.mime_type;
	}
};

/**
 * Returns the "primary" type (the part before the `/`) of the mime type.
 * @param {Object|String} variation Either variation name or object containing attribute "name"
 * @returns {string}
 */
FileSchema.methods.getMimeTypePrimary = function(variation) {
	return this.getMimeType(variation).split('/')[0];
};

/**
 * Returns the sub type (the part after the `/`) of the mime type.
 * @param {Object|String} [variation] Either variation name or object containing attribute "name"
 * @returns {string}
 */
FileSchema.methods.getMimeSubtype = function(variation) {
	return this.getMimeType(variation).split('/')[1];
};

/**
 * Returns the file category.
 * @returns {string}
 */
FileSchema.methods.getMimeCategory = function(variation) {
	return mimeTypes[this.getMimeType(variation)].category;
};

/**
 * Returns something useful for logging.
 * @param {object|string} variation Variation name or whole object
 * @returns {string}
 */
FileSchema.methods.toString = function(variation) {
	const v = _.isObject(variation) ? variation.name : variation;
	return this.file_type + ' "' + this.id + '"' + (v ? ' (' + v + ')' : '');
};

/**
 * Switches a files from inactive to active and moves it to the public folder if necessary.
 * @param {function} [done] Callback
 * @returns {Promise.<File>}
 */
FileSchema.methods.switchToActive = function(done) {

	return Promise.try(() => {
		return mongoose.model('File').update({ _id: this._id }, { is_active: true });

	}).then(() => {
		this.is_active = true;
		return storage.switchToPublic(this);

	}).nodeify(done);
};

/**
 * Locks a file as being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
FileSchema.methods.lock = function(variation) {
	const lockfile = this.getLockFile(variation);
	logger.debug('[file] Locking file at "%s"', lockfile);
	try {
		fs.closeSync(fs.openSync(lockfile, 'w'));
	} catch (err) {
		logger.error('[file] Error creating lock file at "%s": %s', lockfile, err.message);
	}
};

/**
 * Unlocks a file from being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
FileSchema.methods.unlock = function(variation) {
	const lockfile = this.getLockFile(variation);
	logger.debug('[file] Unlocking file at "%s"', lockfile);
	try {
		fs.unlinkSync(lockfile);
	} catch (err) {
		logger.error('[file] Error deleting lock file: %s', err.message);
	}
};

/**
 * Unlocks a file from being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 */
FileSchema.methods.isLocked = function(variation) {
	const lockfile = this.getLockFile(variation);
	return fs.existsSync(lockfile);
};

/**
 * Returns the path of the lock file.
 *
 * Lock files indicate that the file is being processed.
 *
 * @param {Object|String} [variation] Either variation name or object containing attribute "name".
 * @returns {string}                  Lockfile
 */
FileSchema.methods.getLockFile = function(variation) {
	return storage.path(this, variation, { lockFile: true });
};


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
FileSchema.statics.sanitizeObject = function(object, replacement) {
	replacement = replacement || '-';
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
				FileSchema.statics.sanitizeObject(object[property]);
			}
		}
	}
};
FileSchema.statics.toSimple = function(file) {
	if (!file) {
		return file;
	}
	const obj = file.toObj ? file.toObj() : file;
	return _.pick(obj, apiFields.simple);
};
FileSchema.statics.toDetailed = function(file) {
	if (!file) {
		return file;
	}
	const obj = file.toObj ? file.toObj() : file;
	return _.pick(obj, apiFields.detailed.concat(apiFields.simple));
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
FileSchema.post('remove', function(obj, done) {

	return Promise.try(() => {
		// remove physical file
		storage.remove(obj);
		return null;

	}).then(() => {
		// remove table blocks
		const TableBlock = mongoose.model('TableBlock');
		return TableBlock.update(
			{ _files: obj._id },
			{ $pull: { _files: obj._id } },
			{ multi: true }
		).then(() => {
			return TableBlock.remove({ _files: { $size: 0 } }).exec();
		});
	}).nodeify(done);
});

//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
FileSchema.options.toObject = { virtuals: true, versionKey: false };

mongoose.model('File', FileSchema);
logger.info('[model] Schema "File" registered.');
