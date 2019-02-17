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

/**
 * This plugin provides methods to update the counters of an entity and
 * optionally calculate a popularity score based on the weight (hotness) of
 * each counter.
 *
 * @param schema Schema of the model
 * @param options Optional options
 */
export function metricsPlugin<T>(schema: Schema, options: MetricsOptions = {}) {

	const getId = options.getId || (doc => doc.id);

	if (options.hasChildren) {
		schema.post('findOne', onFindOne);
	}

	schema.virtual('hasRelations').get(() => true);
	schema.methods.$updateRelations = function(this: MetricsDocument, parentModel: string, parentId: string, path: string) {
		const arrayFields = path.split(/\.\d+/g);
		const lastArrayField = arrayFields.pop();
		this.$$parentModel = parentModel;
		this.$$parentId = parentId;
		this.$$normalizedPathWithinParent = path.replace(/\.\d+/g, '');
		this.$$queryPathWithinParent = arrayFields.join('.$[]') + (arrayFields.length > 0 ? '.$' : '') + lastArrayField;
	};

	schema.methods.getParentModel = function(this: MetricsDocument) {
		return this.$$parentModel || (this.constructor as any).modelName;
	};

	schema.methods.getParentId = function(this: MetricsDocument) {
		return this.$$parentId || this.id;
	};

	schema.methods.getPathWithinParent = function(this: MetricsDocument, opts: {prefix?: string, suffix?: string} = {}) {
		const path = opts.prefix && this.$$normalizedPathWithinParent
			? `${opts.prefix}.${this.$$normalizedPathWithinParent}`
			: opts.prefix || this.$$normalizedPathWithinParent || '';
		return path && opts.suffix ? `${path}.${opts.suffix}` : path || opts.suffix;
	};

	schema.methods.getQueryFieldPath = function(this: MetricsDocument, suffix?: string) {
		const queryPath = this.$$queryPathWithinParent || '';
		return suffix && queryPath ? `${queryPath}.${suffix}` : queryPath || suffix ;
	};

	/**
	 * Increments a counter.
	 *
	 * @param {string} counterName Property to increment, e.g. 'view'
	 * @param {number} [value=1] How much to increment. Use a negative value for decrement
	 * @returns {Promise}
	 */
	schema.methods.incrementCounter = async function(this: MetricsDocument, counterName: string, value: number = 1): Promise<void> {
		const q: any = {
			$inc: { [getCounterUpdatePath(this, counterName)]: value },
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
		await apiCache.incrementCounter(getCacheModelName(this), getId(this), counterName, value);

		// update db
		const condition = getQueryCondition(this);
		await getModel(this).updateOne(condition, q).exec();
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
 * Returns entity name along with the path where the embedded element is located, if embedded.
 * @param doc Document
 * @return {string} Field path, e.g. `release.versions.files` for a ReleaseVersionFileDocument
 */
function getCacheModelName(doc: MetricsDocument): string {
	if (doc.getParentId() === doc.id) {
		return (doc.constructor as any).modelName.toLowerCase();
	}
	return doc.getPathWithinParent({ prefix: doc.getParentModel().toLowerCase() });
}

/**
 * Returns the query retrieving the entity (and embedded doc, if any).
 * @param doc Document
 * @return {string} Query condition, e.g. `{ _id: "5b60261f687fc336902ffe2d", versions.files._id: "5b60261f687fc336902ffe2f" }`
 */
function getQueryCondition(doc: MetricsDocument): any {
	const condition: any = { id: doc.getParentId() || doc.id };
	if (doc.getParentId() === doc.id) {
		return condition;
	}
	condition[doc.getPathWithinParent({ suffix: '_id' })] = doc._id;
	return condition;
}

/**
 * Returns the query to update the counter of an (embedded) entity
 * @param doc Document or sub-document
 * @param {string} counterName Name of the counter to update
 * @return {string} Path to the counter, e.g. "versions.$[].files.$.counter.downloads" (we use ".$." at the end and ".$[]." otherwise)
 */
function getCounterUpdatePath(doc: MetricsDocument, counterName: string): string {
	if (doc.getParentId() === doc.id) {
		return 'counter.' + counterName;
	}
	return doc.getQueryFieldPath('counter.' + counterName);
}

/**
 * Returns the model of the top-most parent of the document.
 * @param doc Document
 * @return {M}
 */
function getModel<M extends Model<Document> = Model<Document>>(doc: MetricsDocument): M {
	return state.getModel(doc.getParentModel());
}

/**
 * Executed when the entity is retrieved. It updates the parent relations so we
 * can automatically update the cache API and increase counters.
 * @param doc
 * @param next
 */
function onFindOne(doc: MetricsDocument, next: (err?: NativeError) => void) {
	if (doc) {
		updateChildren(doc, this.schema, (doc.constructor as any).modelName, doc.id);
	}
	next();
}

/**
 * Updates all populated children of type `MetricsDocument` with relations to
 * their parents.
 *
 * @param doc Retrieved document
 * @param schema Schema of the document
 * @param parentModel First parent that has its own collection (i.e. isn't nested)
 * @param parentId Entity `id` of the first parent that isn't nested
 * @param [parentPath] Path to parent when called recursively
 */
function updateChildren(doc: MetricsDocument, schema: any, parentModel: string, parentId: string, parentPath: string = '') {

	// single references
	const objectIdPaths: any[] = Object.keys(schema.paths).filter((p: string) => schema.paths[p].instance === 'ObjectID');
	for (const path of objectIdPaths) {
		const child = get(doc, path);
		if (child && child.hasRelations) {
			const currentPath = `${parentPath}${parentPath ? '.' : ''}${path}`;
			if (isChildSchema(schema, path)) {
				child.$updateRelations(parentModel, parentId, currentPath);
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
				child.$updateRelations(parentModel, parentId, currentPath);
				updateChildren(child, get(schema.obj, path).type[0], parentModel, parentId, currentPath);
			} else {
				child.$updateRelations(child.constructor.modelName, child.id, currentPath);
			}
			index++;
		}
	}
}

/**
 * Returns `true` if given path is a child (embedded), or `false` otherwise.
 * @param schema Schema of the document
 * @param path Path within the document
 */
function isChildSchema(schema: any, path: string): boolean {
	return schema.childSchemas.map((cs: any) => cs.model.path).includes(path);
}

declare module 'mongoose' {

	// methods
	export interface MetricsDocument extends Document {

		/**
		 * The counter object
		 */
		counter?: { [key: string]: number };

		// privates
		$$parentModel: string;
		$$parentId: string;
		$$normalizedPathWithinParent: string;
		$$queryPathWithinParent: string;

		/**
		 * Increments a counter.
		 *
		 * @param {string} counterName Property to increment
		 * @param {number} [value=1] How much to increment. Use a negative value for decrement
		 * @returns {Promise<MetricsDocument>} Updated document
		 */
		incrementCounter(counterName: string, value?: number): Promise<void>;

		/**
		 * Returns the path of the entity within the parent, without indexes.
		 *
		 * For example a File within a Release would return "versions.files._file".
		 *
		 * @param opts Options
		 * @param [opts.prefix] Path will be prefixed with prefix plus "."
		 * @param [opts.suffix] Path will be suffixed with "." plus suffix.
		 */
		getPathWithinParent(opts?: {prefix?: string, suffix?: string}): string;

		/**
		 * Returns the query path withing the parent.
		 * @return {string} Path to the counter, e.g. "versions.$[].files.$.counter.downloads"
		 */
		getQueryFieldPath(suffix?: string): string;

		/**
		 * Returns the model of the top-most parent that has its own collection.
		 *
		 * For example, a for a file within a release that would be `File`,
		 * but for a `ReleaseVersion` that would be `Release`.
		 *
		 * @see getParentId()
		 * @returns The `id` of the parent (not the `ObjectID`)
		 */
		getParentModel(): string;

		/**
		 * Returns the id of the top-most parent that has its own collection.
		 *
		 * @see getParentModel()
		 */
		getParentId(): string;

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

		/**
		 * If set, calculate a score.
		 *
		 * The score is based on the weights you define for a given counter,
		 * for example { views: 1, downloads: 10 } means ten views weight the
		 * same as one download.
		 */
		hotness?: {
			[key: string]: { [key: string]: number },
		};

		/**
		 * Returns the ID under which the counter is saved to the cache.
		 *
		 * This is necessary when only the ID isn't enough, for example a
		 * release version needs the release ID as well as the version name.
		 *
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
