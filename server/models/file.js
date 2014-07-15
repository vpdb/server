var _ = require('underscore');
var path = require('path');
var logger = require('winston');
var mongoose = require('mongoose');
var shortId = require('shortid');
var config = require('./../modules/settings').current;
var mimeTypes = require('./../modules/mimetypes');

var Schema = mongoose.Schema;

// schema
var fields = {
	_id:          { type: String, unique: true, 'default': shortId.generate},
	name:         { type: String, required: 'Filename must be provided.' },
	bytes:        { type: Number, required: true },
	created_at:   { type: Date, required: true },
	author:       { type: Schema.ObjectId, required: true, ref: 'User' },
	mime_type:    { type: String, required: true, enum: { values: _.keys(mimeTypes), message: 'Invalid MIME type. Valid MIME types are: ["' +  _.keys(mimeTypes).join('", "') + '"].' }},
	file_type:    { type: String, required: true },
	metadata:     { type: Schema.Types.Mixed },
	public:       { type: Boolean, required: true, default: false },
	active:       { type: Boolean, required: true, default: false },
	variations:   { type: Schema.Types.Mixed }
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
	getPath: function(variationName) {
		var ext = '.' + mimeTypes[this.mime_type].ext;
		return variationName
			? path.resolve(config.vpdb.storage, variationName, this._id.toString()) + ext
			: path.resolve(config.vpdb.storage, this._id.toString()) + ext;
	},

	/**
	 * Returns the URL of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getUrl: function(variationName) {
		return variationName
			? '/storage/' + this._id.toString() + '/' + variationName
			: '/storage/' + this._id.toString();
	},

	getMimeType: function() {
		return this.mime_type.split('/')[0];
	},

	getMimeSubtype: function() {
		return this.mime_type.split('/')[1];
	}
};

mongoose.model('File', FileSchema);
logger.info('[model] Model "file" registered.');
