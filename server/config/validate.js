var path = require('path');
var logger = require('winston');
try {
	var settings = require(path.resolve(__dirname, '../modules/settings'));
} catch (e) {
	logger.error('[settings] Validation failed!');
	process.exit(2);
}
var valid = settings.validate();
if (!valid) {
	logger.error('[settings] Validation failed!');
}
process.exit(valid ? 0 : 1);
