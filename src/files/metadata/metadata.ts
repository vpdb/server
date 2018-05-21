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

import { File } from '../file';
import { FileVariation } from '../file.variations';
import { ArchiveMetadata } from './archive.metadata';
import { ImageMetadata } from './image.metadata';

export abstract class Metadata {

	private static instances: Metadata[] = [new ArchiveMetadata(), new ImageMetadata()];

	/**
	 * Checks if the metadata class can be applied to a given file.
	 *
	 * @param {File} file File to check
	 * @param {FileVariation} [variation] Variation to check
	 * @return {boolean}
	 */
	public abstract isValid(file: File, variation?: FileVariation): boolean;

	/**
	 * Reads the metadata from the file.
	 *
	 * @param {File} file File to read
	 * @param {string} path Path to file to read
	 * @param {FileVariation} [variation] Variation of the file to read
	 * @return Full metadata
	 */
	public abstract async getMetadata(file: File, path: string, variation?: FileVariation): Promise<{ [key: string]: any }>;

	/**
	 * This is what's returned in the detail view of the file
	 * @param metadata Full metadata
	 * @return Subset for detailed view
	 */
	public abstract serializeDetailed(metadata: { [key: string]: any }): { [key: string]: any };

	/**
	 * This is what's returned in the variation view of the file. Pure minimum.
	 * @param metadata Full metadata
	 * @return Subset for reduced view
	 */
	public abstract serializeVariation(metadata: { [key: string]: any }): { [key: string]: any };

	/**
	 * Reads and returns metadata from the file.
	 * @param {File} file
	 * @param {string} path
	 * @param {FileVariation} variation
	 * @returns {Promise<void>}
	 */
	public static async readFrom(file: File, path: string, variation?: FileVariation) {
		const reader = Metadata.instances.find(m => m.isValid(file));
		return Metadata.sanitizeObject(await reader.getMetadata(file, path, variation));
	}

	/**
	 * A helper method that replaces the "$" and "." character in order to be able
	 * to store non-structured objects in MongoDB.
	 *
	 * @param {object} object Object that is going to end up in MongoDB
	 * @param {string} [replacement=-] (optional) Replacement character
	 */
	private static sanitizeObject(object:any, replacement='-') {
		let oldProp;
		for (let property in object) {
			if (object.hasOwnProperty(property)) {
				if (/\.|\$/.test(property)) {
					oldProp = property;
					property = oldProp.replace(/\.|\$/g, replacement);
					object[property] = object[oldProp];
					delete object[oldProp];
				}
				if (typeof object[property] === 'object') {
					Metadata.sanitizeObject(object[property]);
				}
			}
		}
	}
}
