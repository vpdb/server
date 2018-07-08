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
import { format as sprintf } from 'util';

const winston = require('winston'); // todo use typings when available (https://github.com/winstonjs/winston/issues/1190)

export class Logger {
	private logger: any;

	constructor() {
		const alignedWithColorsAndTime = logFormat.combine(
			logFormat.colorize(),
			logFormat.timestamp(),
			//logFormat.align(),
			logFormat.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
		);
		this.logger = winston.createLogger({
			format: alignedWithColorsAndTime,
			transports: [
				new winston.transports.Console(),
			],
			level: process.env.LOGLEVEL || 'silly',
		});
	}

	public wtf(format: any, ...param: any[]) {
		this.logger.log({
			level: 'info',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.redBright, chalk.bgRedBright.whiteBright),
		});
	}

	public error(format: any, ...param: any[]) {
		this.logger.log({
			level: 'error',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.redBright, chalk.whiteBright),
		});
	}

	public warn(format: any, ...param: any[]) {
		this.logger.log({
			level: 'warn',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.yellowBright, chalk.whiteBright),
		});
	}

	public info(format: any, ...param: any[]) {
		this.logger.log({
			level: 'info',
			message: this.colorMessage(sprintf.apply(null, arguments), null, chalk.white),
		});
	}

	public verbose(format: any, ...param: any[]) {
		this.logger.log({
			level: 'verbose',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.gray, chalk.gray),
		});
	}

	public debug(format: any, ...param: any[]) {
		this.logger.log({
			level: 'debug',
			message: this.colorMessage(sprintf.apply(null, arguments), chalk.bgBlack.gray, chalk.gray),
		});
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

export const logger = new Logger();
