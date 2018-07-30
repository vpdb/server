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

import { Document, MetricsDocument, MetricsOptions, Model, ModelProperties, MongooseDocument, Schema } from 'mongoose';
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
			$inc: { [fieldCounterPath(this, counterName)]: value },
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
		await apiCache.incrementCounter(fieldPath(this), this.id, counterName, value);

		const conditions = { [queryPath(this)]: this._id };
		await getModel(this).update(conditions, q);
		//state.models.Release.update({ 'versions._id': version._id }, { $inc: { 'versions.$.counter.downloads': 1 } }).exec());
		//state.models.Release.update({ 'versions._id': version._id }, { $inc: { ['versions.$.files.$.counter.downloads']: 1 } }).exec());

		return this;
		// update db
		//return this.update(q);
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

function fieldPath(doc: any, path: string = ''): string {
	if (doc.__parent) {
		path = '.' + doc.__parentArray._path + path;
		return fieldPath(doc.__parent, path);
	}
	return doc.constructor.modelName.toLowerCase() + path;
}

function queryPath(doc: any, path: string = ''): string {
	if (doc.__parent) {
		path = '.' + doc.__parentArray._path + path;
		return queryPath(doc.__parent, path);
	}
	return path.substr(1) + '._id';
}


function fieldCounterPath(doc: any, counterName: string, path: string = ''): string {
	if (doc.__parent) {
		const separator = doc.__parentArray._schema.$isMongooseDocumentArray ? '.$.' : '.';
		path = doc.__parentArray._path + separator + path;
		return fieldCounterPath(doc.__parent, counterName, path);
	}
	return path + 'counter.' + counterName;
}

function getModel<M extends Model<Document> = Model<Document>>(doc: any): M {
	if (doc.__parent) {
		return getModel(doc.__parent);
	}
	return state.getModel(doc.constructor.modelName);
}

function getEntity(doc: any): Document {
	if (doc.__parent) {
		return getEntity(doc.__parent);
	}
	return doc;
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
