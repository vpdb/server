var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var storage = require('../modules/storage');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true },
	name:         { type: String, required: 'Name must be provided.', unique: true },
	description:  { type: String, required: 'Description must be provided.' },
	is_active:    { type: Boolean, required: true, default: false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User' },
	_releases:    [ { type: Schema.ObjectId, ref: 'Release' } ]
};
var TagSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'name', 'description' ]
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
TagSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
TagSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
TagSchema.path('name').validate(function(name) {
	return validator.isLength(name ? name.trim() : '', 2);
}, 'Name must contain at least two characters.');

TagSchema.path('description').validate(function(description) {
	return validator.isLength(description ? description.trim() : description, 5);
}, 'Name must contain at least 5 characters.');


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
	delete tag._created_by;
	delete tag._releases;
};

mongoose.model('Tag', TagSchema);
logger.info('[model] Model "tag" registered.');