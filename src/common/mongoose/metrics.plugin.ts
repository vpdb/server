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

import { MetricsDocument, MetricsOptions, ModelProperties, Schema } from 'mongoose';
import { state } from '../../state';
import { apiCache } from '../api.cache';

export function metricsPlugin<T>(schema: Schema, options: MetricsOptions = {}) {

	/**
	 * Increments a counter.
	 *
	 * @param {string} counterName Property to increment, e.g. 'view'
	 * @param {number} [value=1] How much to increment. Use a negative value for decrement
	 * @returns {Promise}
	 */
	schema.methods.incrementCounter = async function(counterName: string, value: number = 1): Promise<T> {
		const q: any = {
			$inc: { ['counter.' + counterName]: value },
		};

		if (options.hotness) {
			q.metrics = q.metrics || {};
			Object.keys(options.hotness).forEach(metric => {
				const hotness = options.hotness[metric];
				let score = 0;
				Object.keys(hotness).forEach(variable => {
					const factor = hotness[variable];
					if (this.counter[variable]) {
						score += factor * (this.counter[variable] + (variable === counterName ? value : 0));
					}
				});
				q.metrics[metric] = Math.log(Math.max(score, 1));
			});
		}
		// update cache
		await apiCache.incrementCounter(this.constructor.modelName.toLowerCase(), this.id, counterName, value);
		// update db
		return this.update(q);
	};

	/**
	 * Increments a counter, but without updating any other metric.
	 * Currently only used by the cache middleware.
	 *
	 * @param {string} entityId ID of the entity to update
	 * @param {string} counterName Name of the counter, e.g. "views"
	 * @param {number} [value=1] How much to increment. Use a negative value for decrement
	 */
	schema.statics.incrementCounter = async function(this: ModelProperties, entityId: string, counterName: string, value: number = 1): Promise<void> {
		// update cache
		await apiCache.incrementCounter(this.modelName.toLowerCase(), entityId, counterName, value);
		// update db
		await state.getModel(this.modelName).findOneAndUpdate({ id: entityId }, { $inc: { ['counter.' + counterName]: value } }).exec();
	};
}

declare module 'mongoose' {

	// methods
	export interface MetricsDocument extends Document {

		/**
		 * The counter object
		 */
		counter?: { [key: string]: number };

		/**
		 * Increments a counter.
		 *
		 * @param {string} counterName Property to increment
		 * @param {number} [value=1] How much to increment. Use a negative value for decrement
		 * @returns {Promise<MetricsDocument>} Updated document
		 */
		incrementCounter(counterName: string, value?: number): Promise<MetricsDocument>;
	}

	// statics
	export interface MetricsModel<T extends MetricsDocument> extends Model<T> {
		/**
		 * Increments a counter, but without updating any other metric.
		 * Currently only used by the cache middleware.
		 *
		 * @param {string} entityId ID of the entity to update
		 * @param {string} counterName Name of the counter, e.g. "views"
		 * @param {number} [value=1] How much to increment. Use a negative value for decrement
		 */
		incrementCounter(entityId: string, counterName: string, value?: number): Promise<void>;
	}

	// plugin options
	export interface MetricsOptions {
		hotness?: {
			[key: string]: { [key: string]: number },
		};
	}
}
