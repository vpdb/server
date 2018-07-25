/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import chalk from 'chalk';
import hasAnsi from 'has-ansi';
import { format as logFormat } from 'logform';
import { resolve } from 'path';
import { format as sprintf } from 'util';
import winston from 'winston';

import { LogdnaTransport } from './logger.logdna.transport';
import { config } from './settings';
import { RequestState } from './typings/context';

class Logger {
	private logger: winston.Logger;

	constructor(type: 'app' | 'access') {
		const alignedWithColorsAndTime = logFormat.combine(
			logFormat.colorize(),
			logFormat.timestamp(),
			//logFormat.align(),
			logFormat.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
		);
		this.logger = winston.createLogger({
			format: alignedWithColorsAndTime,
			transports: [],
			level: config.vpdb.logging.level,
		});

		if (type === 'app') {
			this.setupAppLogger();
		}

		if (type === 'access') {
			this.setupAccessLogger();
		}
	}

	public wtf(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'info',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.redBright, chalk.bgRedBright.whiteBright),
		});
	}

	public error(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'error',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.redBright, chalk.whiteBright),
		});
	}

	public warn(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'warn',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.yellowBright, chalk.whiteBright),
		});
	}

	public info(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'info',
			message: this.colorMessage(sprintf.apply(null, arguments), null, chalk.white),
		});
	}

	public verbose(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'verbose',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.gray, chalk.gray),
		});
	}

	public debug(state: RequestState | null, format: any, ...param: any[]) {
		this.logger.log({
			level: 'debug',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.gray, chalk.gray),
		});
	}

	private setupAppLogger(): void {
		if (config.vpdb.logging.console.app) {
			this.logger.add(new winston.transports.Console());
		}
		/* istanbul ignore next */
		if (config.vpdb.logging.file.app) {
			const logPath = resolve(config.vpdb.logging.file.app);
			this.logger.add(new winston.transports.File({
				filename: logPath,               // The filename of the logfile to write output to.
				maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
				maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
			}));
		}
		/* istanbul ignore next */
		if (config.vpdb.logging.logdna.app) {
			this.logger.add(new LogdnaTransport(config.vpdb.logging.logdna.apiKey, {
				app: 'vpdb-app',
				env: config.vpdb.logging.logdna.env,
				hostname: config.vpdb.logging.logdna.hostname,
			}));
		}
	}

	private setupAccessLogger(): void {
		if (config.vpdb.logging.console.access) {
			this.logger.add(new winston.transports.Console());
		}
		/* istanbul ignore next */
		if (config.vpdb.logging.file.access) {
			const logPath = resolve(config.vpdb.logging.file.app);
			this.logger.add(new winston.transports.File({
				filename: logPath,               // The filename of the logfile to write output to.
				maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
				maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
			}));
		}
		/* istanbul ignore next */
		if (config.vpdb.logging.logdna.access) {
			this.logger.add(new LogdnaTransport(config.vpdb.logging.logdna.apiKey, {
				app: 'vpdb-access',
				env: config.vpdb.logging.logdna.env,
				hostname: config.vpdb.logging.logdna.hostname,
			}));
		}
	}

	private colorMessage(message: string, prefixColor: any, messageColor?: any): string {
		if (hasAnsi(message)) {
			return message;
		}
		const match = message.match(/^(\[[^\]]+])(.+)/);
		if (match) {
			let prefix: string;
			if (prefixColor == null) {
				const [m1, m2] = match[1].split('.', 2);
				prefix = m2  ?
					'[' + chalk.cyan(m1.substring(1)) + '.' + chalk.blueBright(m2.substring(0, m2.length - 1)) + ']' :
					'[' + chalk.cyan(match[1].substring(1, match[1].length - 1)) + ']';
			} else {
				prefix = prefixColor(match[1]);
			}
			return prefix + (messageColor ? messageColor(match[2]) : match[2]);
		}
		return messageColor ? messageColor(message) : message;
	}
}

export const logger = new Logger('app');
export const accessLogger = new Logger('access');
