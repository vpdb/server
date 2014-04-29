var path = require('path');
var logger = require('winston');
try {
	var settings = require(path.resolve(__dirname, '../modules/settings'));
} catch (e) {
	logger.log('error', '[settings] Validation failed!');
	process.exit(2);
}
process.exit(settings.validate() ? 0 : 1);
