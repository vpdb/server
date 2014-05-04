var logger = require('winston');

module.exports = function() {

	logger.remove(logger.transports.Console);
	logger.add(logger.transports.Console, {
		level: 'info',   // Level of messages that this transport should log (default 'info').
		silent: false,   // Boolean flag indicating whether to suppress output (default false).
		colorize: true,  // Boolean flag indicating if we should colorize output (default false).
		timestamp: true  // Boolean flag indicating if we should prepend output with timestamps (default false). If function is specified, its return value will be used instead of timestamps.
	});
};