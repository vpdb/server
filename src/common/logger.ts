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

import { state } from '../state';
import { config } from './settings';
import { Context, RequestState } from './typings/context';

const LogDna = require('logdna');

class Logger {
	private logger: winston.Logger;
	private readonly logDnaLogger: any;

	constructor(private type: LogType) {
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

		/* istanbul ignore next */
		if (config.vpdb.logging.logdna.apiKey) {
			this.logDnaLogger = LogDna.createLogger(config.vpdb.logging.logdna.apiKey, {
				app: 'vpdb',
				env: config.vpdb.logging.logdna.env,
				hostname: config.vpdb.logging.logdna.hostname,
				index_meta: true,
			});
		}

		if (type === 'app') {
			this.setupAppLogger();
		}

		if (type === 'access') {
			this.setupAccessLogger();
		}
	}

	public wtf(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			chalk.bgBlack.redBright, chalk.bgRedBright.whiteBright);
		this.log(requestState, 'wtf', message);
	}

	public error(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			chalk.bgBlack.redBright, chalk.whiteBright);
		this.log(requestState, 'error', message);
	}

	public warn(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			chalk.bgBlack.yellowBright, chalk.whiteBright);
		this.log(requestState, 'warn', message);
	}

	public info(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			null, chalk.white);
		this.log(requestState, 'info', message);
	}

	public verbose(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			chalk.bgBlack.gray, chalk.gray);
		this.log(requestState, 'verbose', message);
	}

	public debug(requestState: RequestState | null, format: any, ...param: any[]) {
		const message = this.colorMessage(sprintf.apply(null, Array.from(arguments).splice(1)),
			chalk.bgBlack.gray, chalk.gray);
		this.log(requestState, 'debug', message);
	}

	private log(requestState: RequestState | null, level: string, message: string) {
		this.logger.log({ level: this.getWinstonLevel(level), message });
		/* istanbul ignore if */
		if (this.logDnaLogger) {
			this.logDnaLogger.log(message, {
				timestamp: Date.now(),
				level: this.getLogDnaLevel(level),
				meta: this.getMeta(requestState),
			});
		}
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

	private getMeta(requestState: RequestState) {
		return {
			requestId: requestState.requestId,
			user: state.serializers.User.detailed({ state: requestState } as Context, requestState.user),
			tokenType: requestState.tokenType,
			tokenProvider: requestState.tokenProvider,
			logType: this.type,
		};
	}

	private getLogDnaLevel(level: string): string {
		const map: Map<string, string> = new Map([
			['info', 'info'],
			['error', 'error'],
			['warn', 'warn'],
			['verbose', 'debug'],
			['debug', 'debug'],
			['wtf', 'fatal'],
		]);
		return map.get(level) || 'info';
	}

	private getWinstonLevel(level: string): string {
		const map: Map<string, string> = new Map([
			['info', 'info'],
			['error', 'error'],
			['warn', 'warn'],
			['verbose', 'verbose'],
			['debug', 'debug'],
			['wtf', 'error'],
		]);
		return map.get(level) || 'info';
	}
}

type LogType = 'app' | 'access';
export const logger = new Logger('app');
export const accessLogger = new Logger('access');
