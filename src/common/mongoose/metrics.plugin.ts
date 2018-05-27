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

import { MetricsDocument, MetricsOptions, Schema } from 'mongoose';

export function metricsPlugin<T>(schema: Schema, options:MetricsOptions = {}) {

	/**
	 * Increments a counter.
	 *
	 * @param {string} counterName Property to increment
	 * @param {boolean} [decrement] If set to true, decrement instead counter instead of increment.
	 * @returns {Promise}
	 */
	schema.methods.incrementCounter = async function(counterName:string, decrement:boolean = false): Promise<T> {
		const incr = decrement ? -1 : 1;
		const q:any = {
			$inc: { ['counter.' + counterName]: incr }
		};

		if (options.hotness) {
			q.metrics = q.metrics || {};
			Object.keys(options.hotness).forEach(metric => {
				const hotness = options.hotness[metric];
				let score = 0;
				Object.keys(hotness).forEach(variable => {
					const factor = hotness[variable];
					if (this.counter[variable]) {
						score += factor * (this.counter[variable] + (variable === counterName ? incr : 0));
					}
				});
				q.metrics[metric] = Math.log(Math.max(score, 1));
			});
		}
		return this.update(q);
	};
}

declare module 'mongoose' {

	// methods
	export interface MetricsDocument extends Document {
		/**
		 * Increments a counter.
		 *
		 * @param {string} what Property to increment
		 * @param {boolean} [decrement=false] If set to true, decrement instead counter instead of increment.
		 * @returns {Promise}
		 */
		incrementCounter(what:string, decrement?:boolean): Promise<MetricsDocument>
	}

	// plugin options
	export interface MetricsOptions {
		hotness?: {
			[key:string]: { [key:string]: number }
		}
	}
}
