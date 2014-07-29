"use strict";

var path = require('path');
var logger = require('winston');
try {
	var settings = require(path.resolve(__dirname, '../modules/settings'));
} catch (e) {
	logger.error('[settings] Migration failed!');
	process.exit(2);
}
settings.migrate(function(result) {
	if (result.errors.length > 0) {
		return process.exit(2);
	}
	var importantSettings = [];
	for (var i = 0; i < result.added.length; i++) {
		if (result.added[i].important) {
			importantSettings.push(result.added[i].path);
		}
	}
	if (importantSettings.length > 0) {
		logger.warn('[settings] New important setting%s: [%s]', importantSettings.length === 1 ? '' : 's', importantSettings.join(', '));
		return process.exit(1);
	}
	process.exit(0);
});