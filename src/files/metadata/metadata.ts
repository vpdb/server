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

export abstract class Metadata {

	/**
	 * Reads and returns metadata from the file.
	 * @param {File} file
	 * @param {string} path
	 * @param {FileVariation} variation
	 * @returns {Promise<object | undefined>} Metadata or null if no metadata reader found.
	 */
	public static async readFrom(file: File, path: string, variation?: FileVariation): Promise<{ [key: string]: any } | undefined> {
		const reader = Metadata.getReader(file, variation);
		if (reader === undefined) {
			return undefined;
		}
		return Metadata.sanitizeObject(await reader.getMetadata(file, path, variation));
	}

	/**
	 * Returns the metadata reader for a given file and variation.
	 * @param {File} file File
	 * @param {FileVariation} [variation] Variation or null for original file.
	 * @return {Metadata | undefined} Metadata reader
	 */
	public static getReader(file: File, variation?: FileVariation): Metadata {
		return require('.').instances.find((m: Metadata) => m.isValid(file, variation));
	}

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

	/* tslint:disable:member-ordering */
	/**
	 * A helper method that replaces the "$" and "." character in order to be able
	 * to store non-structured objects in MongoDB.
	 *
	 * @param object Object that is going to end up in MongoDB
	 * @param {string} [replacement='-'] Replacement character
	 * @returns Sanitized object.
	 */
	private static sanitizeObject(object: { [key: string]: any }, replacement = '-'): { [key: string]: any } {
		let oldProp;
		for (let property in object) {
			if (object.hasOwnProperty(property)) {
				if (/[.$]/.test(property)) {
					oldProp = property;
					property = oldProp.replace(/[.$]/g, replacement);
					object[property] = object[oldProp];
					delete object[oldProp];
				}
				if (typeof object[property] === 'object') {
					Metadata.sanitizeObject(object[property]);
				}
			}
		}
		return object;
	}
}
