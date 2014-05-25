var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var mimeTypes = [
	'image/jpeg',
	'image/png',
	'application/zip',
	'application/x-visual-pinball-table',
	'video/mp4',
	'video/x-flv'
];

// schema
var fields = {
	name:         { type: String, required: 'Filename must be provided.' },
	bytes:        { type: Number, required: true },
	created:      { type: Date, required: true },
	author:       { type: Schema.ObjectId, required: true },
	mimeType:     { type: String, required: true, enum: { values: mimeTypes, message: 'Invalid MIME type. Valid MIME types are: ["' + mimeTypes.join('", "') + '"].' }},
	fileType:     { type: String, required: true },
	public:       { type: Boolean, required: true, default: false },
	active:       { type: Boolean, required: true, default: false }
};

var FileSchema = new Schema(fields);

mongoose.model('File', FileSchema);
logger.info('[model] Model "file" registered.');
