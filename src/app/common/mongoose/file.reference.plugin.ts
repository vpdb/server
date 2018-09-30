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

import { get, isArray, keys, omitBy, pickBy } from 'lodash';
import { Document, FileReferenceDocument, FileReferenceOptions, Schema } from 'mongoose';
import { logger } from '../logger';

import { state } from '../../state';
import { RequestState } from '../typings/context';
import { explodePaths, traversePaths } from './util';

/**
 * Adds the following features to a schema:
 *
 * - Validate all fields with a `File` reference
 * - Add method for activating all referenced files
 * - Remove all referenced files when entity is deleted.
 *
 * @param {Schema} schema
 * @param {FileReferenceOptions} options
 */
export function fileReferencePlugin(schema: Schema, options: FileReferenceOptions = {}) {

	// filter ignored paths
	const traversedPaths = traversePaths(schema);
	const paths = pickBy(traversedPaths, isFileReference);
	const fileRefs = omitBy(paths, (schemaType, path) => options.ignore && options.ignore.includes(path));

	//-----------------------------------------------------------------------------
	// VALIDATIONS
	//-----------------------------------------------------------------------------
	for (const path of keys(fileRefs)) {
		schema.path(path).validate(async function(fileId: any) {

			if (!fileId || !this._created_by) {
				return true;
			}
			const file = await state.models.File.findOne({ _id: fileId._id || fileId.toString() }).exec();
			if (!file) {
				return true;
			}

			if (this.isNew && file.is_active) {
				this.invalidate(path, 'Cannot reference active files. If a file is active that means that is has been referenced elsewhere, in which case you cannot reference it again.', file.id);
			}
			return true;

		});
	}

	/**
	 * Sets the referenced files to active. Call this after creating a new
	 * instance.
	 *
	 * Note that only inactive files are activated, already activated files
	 * are ignored.
	 *
	 * @returns {Promise<string[]>} File IDs that have been activated.
	 */
	schema.methods.activateFiles = async function(requestState: RequestState): Promise<string[]> {
		const objPaths = keys(explodePaths(this, fileRefs));
		const ids = objPaths.reduce((acc, path) => {
			const o = get(this, path);
			isArray(o) ? acc.push(...o) : acc.push(o);
			return acc;
		}, []).filter(id => id && id._id);
		const files = await state.models.File.find({ _id: { $in: ids }, is_active: false }).exec();
		for (const file of files) {
			await file.switchToActive(requestState);
		}
		await this.populate(objPaths.join(' ')).execPopulate();
		return files.map(f => f.id);
	};

	/**
	 * Remove file references from database
	 */
	schema.post('remove', async (obj: Document) => {

		const objPaths = keys(explodePaths(obj, fileRefs));
		const ids: string[] = [];
		objPaths.forEach(path => {
			const id = get(obj, path + '._id');
			if (id) {
				ids.push(id);
			}
		});
		const files = await state.models.File.find({ _id: { $in: ids } }).exec();

		// remove file references from db
		for (const file of files) {
			logger.debug(null, '[fileReferencePlugin] Removing referenced file %s', file.toDetailedString());
			await file.remove();
		}
	});
}

function isFileReference(schemaType: any): boolean {
	if (!schemaType.options) {
		return false;
	}
	if (schemaType.options.ref) {
		return schemaType.options.ref === 'File';
	}
	if (isArray(schemaType.options.type) && schemaType.options.type.length > 0 && schemaType.options.type[0].ref) {
		return schemaType.options.type[0].ref === 'File';
	}
	return false;
}

declare module 'mongoose' {

	// methods
	export interface FileReferenceDocument extends Document {

		/**
		 * Sets the referenced files to active. Call this after creating a new
		 * instance.
		 *
		 * Note that only inactive files are activated, already activated files
		 * are ignored.
		 *
		 * @returns {Promise<String[]>} File IDs that have been activated.
		 */
		activateFiles(): Promise<string[]>;

	}

	// options
	export interface FileReferenceOptions {

		/**
		 * Path names to File reference that will be ignored for validation, activation and removal.
		 */
		ignore?: string[];
	}
}
