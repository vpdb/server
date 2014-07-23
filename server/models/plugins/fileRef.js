var util = require('util');

module.exports = exports = function(schema, options) {

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
