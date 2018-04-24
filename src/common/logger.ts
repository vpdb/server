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