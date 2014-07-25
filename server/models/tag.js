var _ = require('underscore');
var logger = require('winston');
var shortId = require('shortid');
var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');

var storage = require('../modules/storage');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true, 'default': shortId.generate },
	name:         { type: String, required: 'Name must be provided.', unique: true },
	description:  { type: String }
};
var TagSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
TagSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
if (!TagSchema.options.toObject) {
	TagSchema.options.toObject = {};
}
TagSchema.options.toObject.transform = function(doc, tag) {
	delete tag.__v;
	delete tag._id;
};

mongoose.model('Tag', TagSchema);
logger.info('[model] Model "tag" registered.');
