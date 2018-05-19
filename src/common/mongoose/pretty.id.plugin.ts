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


import mongoose, { Document, PrettyIdDocument, PrettyIdOptions, Schema } from 'mongoose';
import { assign, isString, omitBy, pickBy, mapValues, includes, keys, set, get } from 'lodash';
import { explodePaths, traversePaths } from './util';
import { logger } from '../logger';

/**
 * Plugin that converts pretty IDs to ObjectIds before passing it to mongoose.
 *
 * While the schema uses ObjectIds, the provided `getInstance()` method
 * replaces pretty IDs coming from the API with object IDs. If invalid,
 * validations will fail on the pretty ID.
 *
 * Any reference in the schema will be considered as pretty, unless provided in
 * the `ignore` option.
 *
 * @param schema
 * @param options
 */
export function prettyIdPlugin(schema: Schema, options: PrettyIdOptions = {}) {

	/* istanbul ignore if */
	if (!options.model) {
		throw new Error('Pretty-id plugin needs model. Please provide.');
	}

	options.ignore = options.ignore || [];
	if (isString(options.ignore)) {
		options.ignore = [options.ignore];
	}
	options.validations = options.validations || [];

	const paths = omitBy(traversePaths(schema), (schemaType, path) => {
		return includes(options.ignore, path.replace(/\.0$/g, ''));
	});

	schema.statics.getInstance = async function (obj: Object): Promise<Document> {

		const invalidations = await replaceIds(obj, paths, options);
		const Model = mongoose.model(options.model);
		const model = new Model(obj);
		//var model = this.model(this.constructor.modelName);

		// for invalid IDs, invalidate instantly so we can provide which value is wrong.
		invalidations.forEach(invalidation => {
			model.invalidate(invalidation.path, invalidation.message, invalidation.value);
		});
		return model;

	};

	schema.methods.updateInstance = async function (obj: Object): Promise<PrettyIdDocument> {

		const invalidations = await replaceIds(obj, paths, options);
		assign(this, obj);

		// for invalid IDs, invalidate instantly so we can provide which value is wrong.
		invalidations.forEach(invalidation => {
			this.invalidate(invalidation.path, invalidation.message, invalidation.value);
		});

		return this;
	};
}

/**
 * Replaces pretty IDs with MongoDB IDs.
 *
 * @param obj
 * @param paths
 * @param options
 * @returns {Promise.<Array>} Promise returning an array of invalidations.
 */
async function replaceIds(obj: Object, paths: { [key: string]: any }, options: PrettyIdOptions): Promise<{ path: string, message: string, value: any }[]> {

	const Model = mongoose.model(options.model);
	const invalidations: { path: string, message: string, value: any }[] = [];
	const models = { [options.model]: Model };
	const refPaths = getRefPaths(obj, paths);

	for (let objPath of keys(refPaths)) {

		const refModelName = refPaths[objPath];
		const RefModel = models[refModelName] || mongoose.model(refModelName);
		models[refModelName] = RefModel;

		let prettyId = get(obj, objPath);

		if (!prettyId) {
			continue;
		}
		if (!isString(prettyId)) {
			invalidations.push({ path: objPath, message: 'ID must be a string.', value: prettyId });
			set(obj, objPath, '000000000000000000000000'); // to avoid class cast error to objectId message
			continue;
		}
		const refObj = await RefModel.findOne({ id: prettyId }).exec();

		if (!refObj) {
			logger.warn('[model] %s ID "%s" not found in database for field %s.', refModelName, prettyId, objPath);
			invalidations.push({
				path: objPath,
				message: 'No such ' + refModelName.toLowerCase() + ' with ID "' + prettyId + '".',
				value: prettyId
			});
			set(obj, objPath, '000000000000000000000000'); // to avoid class cast error to objectId message

		} else {
			// validations
			options.validations.forEach(function (validation) {
				if (validation.path === objPath) {
					if (validation.mimeType && (refObj as any).mime_type !== validation.mimeType) {
						invalidations.push({ path: objPath, message: validation.message, value: prettyId });
					}
					if (validation.fileType && (refObj as any).file_type !== validation.fileType) {
						invalidations.push({ path: objPath, message: validation.message, value: prettyId });
					}
				}
			});

			// convert pretty id to mongdb id
			// console.log('--- Overwriting pretty ID "%s" at %s with %s.', prettyId, objPath, refObj._id);
			set(obj, objPath, refObj._id);
		}
	}
	return invalidations;
}

function getRefPaths(obj: Object, paths: { [key: string]: any }): { [key: string]: string } {

	// pick because it's an object (map)
	const singleRefsFiltered = pickBy(paths, schemaType => schemaType.options && schemaType.options.ref);
	const singleRefs = mapValues(singleRefsFiltered, schemaType => schemaType.options.ref);

	const arrayRefsFiltered = pickBy(paths, schemaType => schemaType.caster && schemaType.caster.instance && schemaType.caster.options && schemaType.caster.options.ref);
	const arrayRefs = mapValues(arrayRefsFiltered, schemaType => schemaType.caster.options.ref);

	return explodePaths(obj, singleRefs, arrayRefs);
}

declare module 'mongoose' {

	// methods
	export interface PrettyIdDocument extends Document {
		/**
		 * Updates the Mongoose document with IDs received in the API.
		 * @param {Object} obj Object received
		 * @returns {Promise<module:mongoose.PrettyIdDocument>} IDs converted from pretty to Mongoose.
		 */
		updateInstance(obj: Object): Promise<PrettyIdDocument>;
	}

	// statics
	export interface PrettyIdModel<T extends PrettyIdDocument> extends Model<T> {
		/**
		 * Replaces API IDs with database IDs and returns a new instance of the
		 * configured model.
		 *
		 * @param {Object} obj Object received
		 * @returns {Promise<T extends module:mongoose.PrettyIdDocument>} IDs converted from pretty to Mongoose.
		 */
		getInstance(obj: Object): Promise<T>;
	}

	// options
	export interface PrettyIdOptions {
		/**
		 * Name of the model
		 */
		model?: string;
		/**
		 * Path names where the ObjectId reference will be ignored.
		 */
		ignore?: string[];

		validations?: { path: string, mimeType: string, message: string, fileType: string }[]
	}
}