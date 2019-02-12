/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { get } from 'lodash';
import { Document, MetricsDocument, MetricsOptions, Model, ModelProperties, NativeError, Schema } from 'mongoose';
import { state } from '../../state';
import { apiCache } from '../api.cache';

export function metricsPlugin<T>(schema: Schema, options: MetricsOptions = {}) {

	const getId = options.getId || (doc => doc.id);

	if (options.hasChildren) {
		schema.post('findOne', onFindOne);
	}

	schema.virtual('hasRelations').get(() => true);
	schema.methods.$updateRelations = function(rootModel: string, rootId: string, path: string) {
		this.$rootModel = rootModel;
		this.$rootId = rootId;
		this.$pathWithinParent = path;
		this.$normalizedPathWithinParent = path.replace(/\.\d+/g, '');
		const arrayFields = path.split(/\.\d+/g);
		const lastArrayField = arrayFields.pop();
		this.$queryPathWithinParent = arrayFields.join('.$[]') + (arrayFields.length > 0 ? '.$' : '') + lastArrayField;
	};

	schema.methods.getRootModel = function() {
		return this.$rootModel || this.constructor.modelName;
	};

	schema.methods.getRootId = function() {
		return this.$rootId || this.id;
	};

	schema.methods.getPathWithinParent = function(prefix?: string) {
		return prefix ? `${prefix}.${this.$pathWithinParent}` : this.$pathWithinParent;
	};

	schema.methods.getNormalizedPathWithinParent = function(opts: {prefix?: string, suffix?: string} = {}) {
		const path = opts.prefix && this.$normalizedPathWithinParent
			? `${opts.prefix}.${this.$normalizedPathWithinParent}`
			: opts.prefix || this.$normalizedPathWithinParent || '';
		return path && opts.suffix ? `${path}.${opts.suffix}` : path || opts.suffix;
	};

	schema.methods.getQueryPathWithinParent = function(suffix?: string) {
		const queryPath = this.$queryPathWithinParent || '';
		return suffix && queryPath ? `${queryPath}.${suffix}` : queryPath || suffix ;
	};

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
	if (doc.getRootId() === doc.id) {
		return doc.constructor.modelName.toLowerCase();
	}
	return doc.getNormalizedPathWithinParent({ prefix: doc.getRootModel().toLowerCase() });
}

/**
 * Returns the query retrieving the entity (and embedded doc, if any).
 * @param doc Document
 * @return {string} Query condition, e.g. `{ _id: "5b60261f687fc336902ffe2d", versions.files._id: "5b60261f687fc336902ffe2f" }`
 */
function queryCondition(doc: MetricsDocument): any {
	const condition: any = { id: doc.getRootId() || doc.id };
	if (doc.getRootId() === doc.id) {
		return condition;
	}
	condition[doc.getNormalizedPathWithinParent({ suffix: '_id' })] = doc._id;
	return condition;
}

/**
 * Returns the path to update for the query.
 * @param doc Document or sub-document
 * @param {string} counterName Name of the counter to update
 * @return {string} Path to the counter, e.g. "versions.$[].files.$.counter.downloads" (we use ".$." at the end and ".$[]." otherwise)
 */
function fieldCounterPath(doc: MetricsDocument, counterName: string): string {
	// if the doc's the root doc, don't include path within parent, because we're updating the doc directly.
	if (doc.getRootId() === doc.id) {
		return 'counter.' + counterName;
	}
	return doc.getQueryPathWithinParent('counter.' + counterName);
}

/**
 * Returns the model of the top-most parent of the document.
 * @param doc Document
 * @return {M}
 */
function getModel<M extends Model<Document> = Model<Document>>(doc: MetricsDocument): M {
	return state.getModel(doc.getRootModel());
}

function onFindOne(doc: any, next: (err?: NativeError) => void) {
	if (doc) {
		updateChildren(doc, this.schema, doc.constructor.modelName, doc.id);
	}
	next();
}

function updateChildren(doc: Document, schema: any, rootModel: string, rootId: string, parentPath: string = '') {

	// single references
	const objectIdPaths: any[] = Object.keys(schema.paths).filter((p: string) => schema.paths[p].instance === 'ObjectID');
	for (const path of objectIdPaths) {
		const child = get(doc, path);
		if (child && child.hasRelations) {
			const currentPath = `${parentPath}${parentPath ? '.' : ''}${path}`;
			if (isChildSchema(schema, path)) {
				child.$updateRelations(rootModel, rootId, currentPath);
			} else {
				child.$updateRelations(child.constructor.modelName, child.id, currentPath);
			}
		}
	}

	// arrays
	const arrayPaths: any[] = Object.keys(schema.paths).filter((p: string) => schema.paths[p].instance === 'Array');
	for (const path of arrayPaths) {
		const children = get(doc, path).filter((child: any) => child && child.hasRelations);
		let index = 0;
		for (const child of children) {
			const currentPath = `${parentPath}${parentPath ? '.' : ''}${path}.${index}`;
			if (isChildSchema(schema, path)) {
				child.$updateRelations(rootModel, rootId, currentPath);
				updateChildren(child, get(schema.obj, path).type[0], rootModel, rootId, currentPath);
			} else {
				child.$updateRelations(child.constructor.modelName, child.id, currentPath);
			}
			index++;
		}
	}
}

function isChildSchema(schema: any, path: string) {
	return schema.childSchemas.map((cs: any) => cs.model.path).includes(path);
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

		/**
		 * Returns the path within the parent inclusively indexes.
		 *
		 * For example a File within a Release would return "versions.0.files.0._file".
		 *
		 * @param prefix If set, append this plus `.` to the path.
		 */
		getPathWithinParent(prefix?: string): string;

		/**
		 * Returns the normalized path within the parent inclusively indexes.
		 *
		 * For example a File within a Release would return "versions.files._file".
		 *
		 * @param opts Options
		 * @param [opts.prefix] Path will be prefixed with prefix plus "."
		 * @param [opts.suffix] Path will be suffixed with "." plus suffix.
		 */
		getNormalizedPathWithinParent(opts?: {prefix?: string, suffix?: string}): string;

		/**
		 * Returns the query path withing the parent.
		 * @return {string} Path to the counter, e.g. "versions.$[].files.$.counter.downloads"
		 */
		getQueryPathWithinParent(suffix?: string): string;

		/**
		 * Returns the model of the top-most parent.
		 */
		getRootModel(): string;

		/**
		 * Returns the id of the top-most parent, or the document ID if it's the same.
		 */
		getRootId(): string;
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

		/**
		 * Don't update references on update since there are no children anyway
		 */
		hasChildren?: boolean;
	}
}
