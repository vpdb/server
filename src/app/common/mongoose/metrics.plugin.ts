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

import { Document, MetricsDocument, MetricsOptions, Model, ModelProperties, Schema } from 'mongoose';
import { state } from '../../state';
import { apiCache } from '../api.cache';

export function metricsPlugin<T>(schema: Schema, options: MetricsOptions = {}) {

	const getId = options.getId || (doc => doc.id);

	/**
	 * Increments a counter.
	 *
	 * @param {string} counterName Property to increment, e.g. 'view'
	 * @param {number} [value=1] How much to increment. Use a negative value for decrement
	 * @returns {Promise}
	 */
	schema.methods.incrementCounter = async function(counterName: string, value: number = 1): Promise<void> {
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
		await apiCache.incrementCounter(fieldPath(this), getId(this), counterName, value);

		// update db
		const condition = queryCondition(this);
		await getModel(this).update(condition, q).exec();
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

/**
 * Returns entity name along with the path where the embedded element is located, if any.
 * @param doc Document
 * @param {string} [path]='' Current path while transversing
 * @return {string} Field path, e.g. `release.versions.files` for a ReleaseVersionFileDocument
 */
function fieldPath(doc: any, path: string = ''): string {
	if (doc.__parent) {
		path = '.' + doc.__parentArray._path + path;
		return fieldPath(doc.__parent, path);
	}
	return doc.constructor.modelName.toLowerCase() + path;
}

/**
 * Returns the query retrieving the entity (and embedded doc, if any).
 * @param doc Document
 * @param {string} [path]='' Current path while transversing
 * @param {ObjectId} [id] Sub-document ID
 * @return {string} Query condition, e.g. `{ _id: "5b60261f687fc336902ffe2d", versions.files._id: "5b60261f687fc336902ffe2f" }`
 */
function queryCondition(doc: any, path: string = '', id: any = null): any {
	if (doc.__parent) {
		path = '.' + doc.__parentArray._path + path;
		return queryCondition(doc.__parent, path, id || doc._id);
	}
	const condition: any = { _id: doc._id };
	if (path) {
		condition[path.substr(1) + '._id'] = id;
	}
	return condition;
}

/**
 * Returns the path to update for the query.
 * @param doc Document or sub-document
 * @param {string} counterName Name of the counter to update
 * @param {string} [path] Current path while transversing
 * @param {string} [separator] Current separator, since we use ".$." at the end and ".$[]." otherwise
 * @return {string} Path to the counter, e.g. "versions.$[].files.$.counter.downloads"
 */
function fieldCounterPath(doc: any, counterName: string, path: string = '', separator = ''): string {
	if (doc.__parent) {
		const isArray = doc.__parentArray._schema.$isMongooseDocumentArray;
		separator = isArray ? (separator || '.$.') : '.';
		path = doc.__parentArray._path + separator + path;
		return fieldCounterPath(doc.__parent, counterName, path, '.$[].');
	}
	return path + 'counter.' + counterName;
}

/**
 * Returns the model of the top-most parent of the document.
 * @param doc Document
 * @return {M}
 */
function getModel<M extends Model<Document> = Model<Document>>(doc: any): M {
	if (doc.__parent) {
		return getModel(doc.__parent);
	}
	return state.getModel(doc.constructor.modelName);
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
		incrementCounter(counterName: string, value?: number): Promise<void>;
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
		/**
		 * Returns the ID under which the counter is saved to the cache.
		 * @param {Document} obj The potentially embedded document
		 * @return {string} Value of the ID(s)
		 */
		getId?: (obj: Document) => string;
	}
}
