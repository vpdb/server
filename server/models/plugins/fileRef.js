var _ = require('underscore');
var util = require('util');
var mongoose = require('mongoose');
var objectPath = require('object-path');



module.exports = exports = function(schema, options) {

	if (!options || !options.model) {
		throw new Error('Fileref plugin needs model. Please provide.');
	}
	if (!options.fields || !_.isArray(options.fields)) {
		throw new Error('Fileref plugin needs file reference fields. Please provide.');
	}

	schema.statics.getInstance = function(obj, callback) {

		var Model = mongoose.model(options.model);
		var File = mongoose.model('File');

		var shortIds = [];
		_.each(options.fields, function(path) {
			var shortId = objectPath.get(obj, path);
			if (shortId) {
				shortIds.push(shortId)
			}
		});
		File.find({ id: { $in: shortIds }}, function(err, files) {
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return callback(err);
			}
			// switch id with _id
			_.each(files, function(file) {
				_.each(options.fields, function(path) {
					if (file.id == objectPath.get(obj, path)) {
						console.log('############# setting %s to %s', path, file._id.toString());
						objectPath.set(obj, path, file._id);
					}
				});
			});
			callback(null, new Model(obj));
		});
	};


	schema.pre('validate', function(next) {
		console.log('********* post-validate: ' + util.inspect(this, null, 4, true));
		console.log('********* Replacing short IDs of ' + options.fields + " with real IDs.");
		var attr = getAttr(this, 'media.backglass');
		console.log('********* backglass = ' + attr);
		next();
	});

	if (options && options.fields) {
		console.log('********* Added reference support to ' + options.fields);
	}
};

function getAttr(obj, attr) {
	if (~attr.indexOf('.')) {
		var attrs = attr.split('.');
		if (!obj[attrs[0]]) {
			obj[attrs[0]] = {};
		}
		return getAttr(obj[attrs[0]], attrs.splice(0, 1).join('.'))
	} else {
		return obj[attr];
	}
}
