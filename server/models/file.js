var _ = require('underscore');
var path = require('path');
var logger = require('winston');
var mongoose = require('mongoose');
var config = require('./../modules/settings').current;

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
	author:       { type: Schema.ObjectId, required: true, ref: 'User' },
	mimeType:     { type: String, required: true, enum: { values: mimeTypes, message: 'Invalid MIME type. Valid MIME types are: ["' + mimeTypes.join('", "') + '"].' }},
	fileType:     { type: String, required: true },
	metadata:     { type: Schema.Types.Mixed },
	public:       { type: Boolean, required: true, default: false },
	active:       { type: Boolean, required: true, default: false }
};

var FileSchema = new Schema(fields);


// methods
FileSchema.methods = {

	/**
	 * Returns the physical location of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getPath: function() {
		return path.resolve(config.vpdb.storage, this._id.toString());
	},

	/**
	 * Returns the URL of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getUrl: function() {
		return '/storage/' + this._id.toString();
	}
};

mongoose.model('File', FileSchema);
logger.info('[model] Model "file" registered.');
