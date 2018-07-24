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

import TransportStream = require('winston-transport');
const { LEVEL, MESSAGE } = require('triple-beam');
const LogDna = require('logdna');

export class LogdnaTransport extends TransportStream {

	private logger: any;

	constructor(apiKey: string, opts: LogdnaTransportOptions) {
		super(opts);

		this.logger = LogDna.createLogger(apiKey, opts);
	}

	public log(info: any, next: () => void): any {
		setImmediate(() => this.emit('logged', info));

		this.logger.log(info[MESSAGE], info[LEVEL]);

		if (next) {
			next();
		}
	}
}

export interface LogdnaTransportOptions extends TransportStream.TransportStreamOptions {

	/**
	 * The default app passed along with every log sent through this instance.
	 */
	app?: string;

	/**
	 * The default hostname passed along with every log sent through this instance.
	 */
	hostname?: string;

	/**
	 * The default environment passed along with every log sent through this instance.
	 */
	env?: string;

	/**
	 * We allow meta objects to be passed with each line. By default these meta
	 * objects will be stringified and will not be searchable, but will be
	 * displayed for informational purposes.
	 *
	 * If this option is turned to true then meta objects will be parsed and
	 * will be searchable up to three levels deep. Any fields deeper than three
	 * levels will be stringified and cannot be searched.
	 *
	 * WARNING When this option is true, your metadata objects across all types
	 * of log messages MUST have consistent types or the metadata object may
	 * not be parsed properly!
	 */
	index_meta?: boolean;

	/**
	 * The default IP Address passed along with every log sent through this instance.
	 */
	ip?: string;
}
