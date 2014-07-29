var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
var fields = {
	id:           { type: String, required: true, unique: true },
	label:        { type: String, required: 'A label must be provided.', unique: true },
	download_url: { type: String },
	support_url:  { type: String },
	description:  { type: String },
	built_at:     { type: Date },
	type:         { type: String, required: true, enum: { values: [ 'release', 'nightly', 'experimental' ], message: 'Invalid type. Valid orientation are: ["release", "nightly", "experimental"].' }},
	is_range:     { type: Boolean, required: true, default: false },
	is_active:    { type: Boolean, required: true, default: false },
	created_at:   { type: Date, required: true },
	_created_by:  { type: Schema.ObjectId, ref: 'User' }
};
var VPBuildSchema = new Schema(fields);


//-----------------------------------------------------------------------------
// API FIELDS
//-----------------------------------------------------------------------------
var apiFields = {
	simple: [ 'id', 'label', 'download_url', 'description', 'built_at', 'type', 'is_range' ]
};


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
VPBuildSchema.virtual('created_by')
	.get(function() {
		if (this._created_by && this.populated('_created_by')) {
			return this._created_by.toReduced();
		}
	});


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
VPBuildSchema.methods.toSimple = function() {
	return _.pick(this.toObject(), apiFields.simple);
};


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
VPBuildSchema.path('label').validate(function(label) {
	return validator.isLength(label ? label.trim() : '', 3);
}, 'Label must contain at least three characters.');


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
VPBuildSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
if (!VPBuildSchema.options.toObject) {
	VPBuildSchema.options.toObject = {};
}
VPBuildSchema.options.toObject.transform = function(doc, vpbuild) {
	delete vpbuild.__v;
	delete vpbuild._id;
	delete vpbuild._created_by;
};

mongoose.model('VPBuild', VPBuildSchema);
logger.info('[model] Model "vpbuild" registered.');