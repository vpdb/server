/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

"use strict";

var _ = require('underscore');
var path = require('path');
var logger = require('winston');
var mongoose = require('mongoose');
var shortId = require('shortid');
var config = require('./../modules/settings').current;

var storage = require('../modules/storage');
var mimeTypes = require('../modules/mimetypes');

var Schema = mongoose.Schema;

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true, 'default': shortId.generate },
	name:         { type: String, required: 'Filename must be provided.' },
	bytes:        { type: Number, required: true },
	mime_type:    { type: String, required: true, 'enum': { values: _.keys(mimeTypes), message: 'Invalid MIME type. Valid MIME types are: ["' +  _.keys(mimeTypes).join('", "') + '"].' }},
	file_type:    { type: String, required: true }, // TODO make enum
	metadata:     { type: Schema.Types.Mixed },
	variations:   { type: Schema.Types.Mixed },
	is_active:    { type: Boolean, required: true, 'default': false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, required: true, ref: 'User' }
};
var FileSchema = new Schema(fields);

//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'url', 'variations', 'is_protected' ], // fields returned in references
	detailed: [ 'name', 'bytes', 'created_at', 'mime_type', 'file_type', 'metadata' ]
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
 * `protected` means that the file is served only to logged users
 */
FileSchema.virtual('is_protected')
	.get(function() {
		return !this.is_active || !this.is_public;
	});

/**
 * `public` means that the file is also served to anonymous users
 *
 * Note that "is public" currently equals to "is free", meaning we can't have
 * files that don't hit the user's quota and are not served to anonymous.
 *
 * Also note that undefined MIME types are public by default.
 */
FileSchema.virtual('is_public')
	.get(function() {
		return config.vpdb.quota.costs[this.mime_type] ? false : true;
	});

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

FileSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};
FileSchema.methods.toDetailed = function() {
	return _.pick(this.toObject(), apiFields.detailed.concat(apiFields.simple));
};

/**
 * Returns the physical location of the file.
 *
 * @return {Object|String} Either variation name or object containing attribute "name"
 * @api public
 */
FileSchema.methods.getPath = function(variation) {
	var variationName = _.isObject(variation) ? variation.name : variation;
	var ext = '.' + mimeTypes[this.mime_type].ext;
	return variationName ?
		path.resolve(config.vpdb.storage, variationName, this.id) + ext :
		path.resolve(config.vpdb.storage, this.id) + ext;
};

/**
 * Returns the URL of the file.
 *
 * @return {Object|String} Either variation name or object containing attribute "name"
 * @api public
 */
FileSchema.methods.getUrl = function(variation) {
	var variationName = _.isObject(variation) ? variation.name : variation;
	return variationName ?
		'/storage/' + this.id + '/' + variationName :
		'/storage/' + this.id;
};

/**
 * Returns the "primary" type (the part before the `/`) of the mime type.
 * @returns {string}
 */
FileSchema.methods.getMimeType = function() {
	return this.mime_type.split('/')[0];
};

/**
 * Returns the sub type (the part after the `/`) of the mime type.
 * @returns {string}
 */
FileSchema.methods.getMimeSubtype = function() {
	return this.mime_type.split('/')[1];
};


//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
FileSchema.post('remove', function(obj, done) {
	storage.remove(obj);
	done();
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
FileSchema.set('toObject', { virtuals: true });
if (!FileSchema.options.toObject) {
	FileSchema.options.toObject = {};
}
FileSchema.options.toObject.transform = function(doc, file) {
	delete file.__v;
	delete file._id;
	delete file._created_by;
	file.variations = storage.urls(doc);
	file.metadata = storage.metadataShort(doc);
};

mongoose.model('File', FileSchema);
logger.info('[model] Model "file" registered.');
