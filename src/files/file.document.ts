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

import chalk from 'chalk';
import { File, FilePathOptions } from './file';
import { mimeTypes } from './file.mimetypes';
import { resolve } from 'path';
import { FileVariation } from './file.variations';
import { config, settings } from '../common/settings';
import { quota } from '../common/quota';
import { fileTypes } from './file.types';

/**
 * Contains the Game's instance methods so they can also be accessed
 * from dehydrated objects.
 */
export class FileDocument {

	/**
	 * Returns the local path where the file is stored.
	 *
	 * Note that this is to *construct* the file name, and doesn't mean that the
	 * file actually exists at the given location.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @param {FilePathOptions} opts Path options
	 * @return {string} Absolute path to storage
	 */
	public static getPath(file: File, variation: FileVariation = null, opts: FilePathOptions = {}): string {
		const baseDir = FileDocument.isPublic(file, variation) && !opts.forceProtected ? config.vpdb.storage.public.path : config.vpdb.storage.protected.path;
		const suffix = opts.tmpSuffix || '';
		return variation ?
			resolve(baseDir, variation.name, file.id) + suffix + FileDocument.getExt(file, variation) :
			resolve(baseDir, file.id) + suffix + FileDocument.getExt(file, variation);
	}

	/**
	 * Returns the file extension, inclusively the dot.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} File extension
	 */
	public static getExt(file: File, variation: FileVariation = null): string {
		return '.' + mimeTypes[FileDocument.getMimeType(file, variation)].ext;
	}

	/**
	 * Returns the public URL of the file.
	 *
	 * Note that the URL can change whether the file is protected or not.
	 * Typically a release file is protected during release upload and becomes
	 * public only after submission.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	public static getUrl(file: File, variation: FileVariation = null): string {
		let storageUri = FileDocument.isPublic(file, variation) ? settings.storagePublicUri.bind(settings) : settings.storageProtectedUri.bind(settings);
		return variation ?
			storageUri('/files/' + variation.name + '/' + file.id + FileDocument.getExt(file, variation)) :
			storageUri('/files/' + file.id + FileDocument.getExt(file, variation));
	}

	/**
	 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean}
	 */
	public static isPublic(file: File, variation: FileVariation = null): boolean {
		return file.is_active && quota.getCost(file, variation) === -1;
	}

	/**
	 *  Returns true if the file is free (as in doesn't cost any credit), false otherwise.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean} True if free, false otherwise.
	 */
	public static isFree(file: File, variation: FileVariation = null): boolean {
		return quota.getCost(file, variation) <= 0;
	}

	/**
	 * Returns the MIME type for a given variation (or for the main file if not specified).
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} MIME type of the file or its variation.
	 */
	public static getMimeType(file: File, variation?: FileVariation): string {
		if (variation && file.variations && file.variations[variation.name] && file.variations[variation.name].mime_type) {
			return file.variations[variation.name].mime_type;

		} else if (variation && variation.mimeType) {
			return variation.mimeType;

		} else {
			return file.mime_type;
		}
	}

	/**
	 * Returns the "primary" type (the part before the `/`) of the mime type.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Primary part of the MIME type.
	 */
	public static getMimeTypePrimary(file: File, variation: FileVariation = null): string {
		return FileDocument.getMimeType(file, variation).split('/')[0];
	}

	/**
	 * Returns the sub type (the part after the `/`) of the mime type.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Secondary part of the MIME type.
	 */
	public static getMimeSubtype(file: File, variation: FileVariation = null): string {
		return FileDocument.getMimeType(file, variation).split('/')[1];
	}

	/**
	 * Returns the file category.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	public static getMimeCategory(file: File, variation: FileVariation = null): string {
		return mimeTypes[FileDocument.getMimeType(file, variation)].category;
	}

	/**
	 * Returns something useful for logging.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} variation File variation or null for original file
	 * @returns {string}
	 */
	public static toShortString(file: File, variation: FileVariation = null): string {
		const color = variation ? chalk.underline : chalk.underline.bold;
		return color(file.file_type + ' "' + file.id + '"' + (variation ? ' (' + variation.name + ')' : ''));
	}

	/**
	 * Returns something even more useful for logging.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} variation File variation or null for original file
	 * @returns {string}
	 */
	public static toDetailedString(file: File, variation?: FileVariation): string {
		const color = variation ? chalk.underline : chalk.underline.bold;
		return color(file.file_type + '@' + FileDocument.getMimeType(file, variation) + ' "' + file.id + '"' + (variation ? ' (' + variation.name + ')' : ''));
	}

	/**
	 * Returns all variations that are stored in the database for this file.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @returns {FileVariation[]} Existing variations
	 */
	public static getExistingVariations(file: File): FileVariation[] {
		const variations: FileVariation[] = [];
		if (!file.variations) {
			return [];
		}
		for (let name of Object.keys(file.variations)) {
			variations.push({ name: name, mimeType: file.variations[name].mime_type });
		}
		return variations;
	}

	/**
	 * Returns all defined variations for this file.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @returns {FileVariation[]}
	 */
	public static getVariations(file: File): FileVariation[] {
		return fileTypes.getVariations(file.file_type, file.mime_type);
	}

	/**
	 * Checks whether a variation for the given file exists.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {string} variationName Name of the variation
	 * @returns {FileVariation | null} File variation or null if the variation doesn't exist.
	 */
	public static getVariation(file: File, variationName: string): FileVariation | null {
		if (!variationName) {
			return null;
		}
		return fileTypes.getVariations(file.file_type, file.mime_type).find(v => v.name === variationName);
	}

	/**
	 * Returns all direct and indirect dependencies of a variation.
	 *
	 * A dependency is the `source` attribute that indicates that the variation
	 * is not generated based on the original file, but rather on another
	 * variation.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} variation Variation
	 * @param {FileVariation[]} [deps] Only used for internal recursive usage, ignore.
	 * @returns {FileVariation[]} All variations that depend directly or indirectly on the given variation.
	 */
	public static getVariationDependencies(file: File, variation: FileVariation, deps: FileVariation[] = []): FileVariation[] {
		deps = deps || [];
		for (let dep of FileDocument.getVariations(file).filter(v => v.source === variation.name)) {
			deps = FileDocument.getVariationDependencies(file, dep, [...deps, dep]);
		}
		return deps;
	}

	/**
	 * Returns all direct dependencies of a variation.
	 *
	 * @param {File} file Potentially dehydrated file
	 * @param {FileVariation} variation Variation
	 * @returns {FileVariation[]} All variations that depend directly on the given variation.
	 */
	public static getDirectVariationDependencies(file: File, variation: FileVariation): FileVariation[] {
		return FileDocument.getVariations(file).filter(v => v.source === variation.name);
	}
}