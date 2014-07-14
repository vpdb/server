var _ = require('underscore');
var path = require('path');
var logger = require('winston');
var mongoose = require('mongoose');
var config = require('./../modules/settings').current;
var mimeTypes = require('./../modules/mimetypes');

var Schema = mongoose.Schema;

// schema
var fields = {
	name:         { type: String, required: 'Filename must be provided.' },
	bytes:        { type: Number, required: true },
	created:      { type: Date, required: true },
	author:       { type: Schema.ObjectId, required: true, ref: 'User' },
	mimeType:     { type: String, required: true, enum: { values: _.keys(mimeTypes), message: 'Invalid MIME type. Valid MIME types are: ["' +  _.keys(mimeTypes).join('", "') + '"].' }},
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
	getPath: function(size) {
		return size
			? path.resolve(config.vpdb.storage, size, this._id.toString())
			: path.resolve(config.vpdb.storage, this._id.toString());
	},

	/**
	 * Returns the URL of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getUrl: function(size) {
		return size
			? '/storage/' + this._id.toString() + '/' + size
			: '/storage/' + this._id.toString();
	}
};

mongoose.model('File', FileSchema);
logger.info('[model] Model "file" registered.');
