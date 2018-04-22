import { format } from 'util';
import { format as logFormat } from 'logform';
const winston = require('winston'); // todo use typings when available

export class Logger {
	private logger: any;

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

	error(f: any, ...param: any[]) {
		this.logger.log({
			level: 'error',
			message: format.apply(null, arguments)
		});
	}
	warn(f: any, ...param: any[]) {
		this.logger.log({
			level: 'warn',
			message: format.apply(null, arguments)
		});
	}
	info(f: any, ...param: any[]) {
		this.logger.log({
			level: 'info',
			message: format.apply(null, arguments)
		});
	}
	verbose(f: any, ...param: any[]) {
		this.logger.log({
			level: 'verbose',
			message: format.apply(null, arguments)
		});
	}
	debug(f: any, ...param: any[]) {
		this.logger.log({
			level: 'debug',
			message: format.apply(null, arguments)
		});
	}
}

export const logger = new Logger();