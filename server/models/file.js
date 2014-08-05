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
	is_public:    { type: Boolean, required: true, 'default': false },
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

FileSchema.virtual('is_protected')
	.get(function() {
		return !this.is_active || !this.is_public;
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
 * @return {String}
 * @api public
 */
FileSchema.methods.getPath = function(variationName) {
	var ext = '.' + mimeTypes[this.mime_type].ext;
	return variationName ?
		path.resolve(config.vpdb.storage, variationName, this.id) + ext :
		path.resolve(config.vpdb.storage, this.id) + ext;
};

/**
 * Returns the URL of the file.
 *
 * @return {String}
 * @api public
 */
FileSchema.methods.getUrl = function(variationName) {
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
