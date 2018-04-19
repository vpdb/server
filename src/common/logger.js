const { format } = require('util');
const winston = require('winston');
const logFormat = require('logform').format;

class Logger {

	constructor() {
		const alignedWithColorsAndTime = logFormat.combine(
			logFormat.colorize(),
			logFormat.timestamp(),
			logFormat.align(),
			logFormat.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
		);
		this.logger = winston.createLogger({
			format: alignedWithColorsAndTime,
			transports: [
				new winston.transports.Console(),
			]
		});
	}

	error() {
		this.logger.log({
			level: 'error',
			message: format.apply(null, arguments)
		});
	}
	warn() {
		this.logger.log({
			level: 'warn',
			message: format.apply(null, arguments)
		});
	}
	info() {
		this.logger.log({
			level: 'info',
			message: format.apply(null, arguments)
		});
	}
	verbose() {
		this.logger.log({
			level: 'verbose',
			message: format.apply(null, arguments)
		});
	}
	debug() {
		this.logger.log({
			level: 'debug',
			message: format.apply(null, arguments)
		});
	}
}

module.exports = new Logger();