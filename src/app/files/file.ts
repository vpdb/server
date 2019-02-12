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

import chalk from 'chalk';
import { resolve } from 'path';
import { quota } from '../common/quota';
import { config, settings } from '../common/settings';
import { RequestState } from '../common/typings/context';
import { FileDocument, FilePathOptions } from './file.document';
import { mimeTypes } from './file.mimetypes';
import { fileTypes } from './file.types';
import { FileVariation } from './file.variations';

/**
 * Contains the Game's instance methods so they can also be accessed
 * from dehydrated objects.
 */
export class File {

	/**
	 * Returns the local path where the file is stored.
	 *
	 * Note that this is to *construct* the file name, and doesn't mean that the
	 * file actually exists at the given location.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @param {FilePathOptions} opts Path options
	 * @return {string} Absolute path to storage
	 */
	public static getPath(requestState: RequestState, file: FileDocument, variation: FileVariation = null, opts: FilePathOptions = {}): string {
		const baseDir = File.isPublic(requestState, file, variation) && !opts.forceProtected ? config.vpdb.storage.public.path : config.vpdb.storage.protected.path;
		const suffix = opts.tmpSuffix || '';
		return variation ?
			resolve(baseDir, variation.name, file.id) + suffix + File.getExt(file, variation) :
			resolve(baseDir, file.id) + suffix + File.getExt(file, variation);
	}

	/**
	 * Returns the file extension, inclusively the dot.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} File extension
	 */
	public static getExt(file: FileDocument, variation: FileVariation = null): string {
		return '.' + mimeTypes[File.getMimeType(file, variation)].ext;
	}

	/**
	 * Returns the public URL of the file.
	 *
	 * Note that the URL can change whether the file is protected or not.
	 * Typically a release file is protected during release upload and becomes
	 * public only after submission.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	public static getUrl(requestState: RequestState, file: FileDocument, variation: FileVariation = null): string {
		const storageUri = File.isPublic(requestState, file, variation) ? settings.storagePublicUri.bind(settings) : settings.storageProtectedUri.bind(settings);
		return variation ?
			storageUri('/files/' + variation.name + '/' + file.id + File.getExt(file, variation)) :
			storageUri('/files/' + file.id + File.getExt(file, variation));
	}

	/**
	 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean}
	 */
	public static isPublic(requestState: RequestState, file: FileDocument, variation: FileVariation = null): boolean {
		return file.is_active && quota.getCost(requestState, file, variation) === -1;
	}

	/**
	 *  Returns true if the file is free (as in doesn't cost any credit), false otherwise.
	 *
	 * @param requestState For logging
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean} True if free, false otherwise.
	 */
	public static isFree(requestState: RequestState, file: FileDocument, variation: FileVariation = null): boolean {
		return quota.getCost(requestState, file, variation) <= 0;
	}

	/**
	 * Returns the MIME type for a given variation (or for the main file if not specified).
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} MIME type of the file or its variation.
	 */
	public static getMimeType(file: FileDocument, variation?: FileVariation): string {
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
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Primary part of the MIME type.
	 */
	public static getMimeTypePrimary(file: FileDocument, variation: FileVariation = null): string {
		return File.getMimeType(file, variation).split('/')[0];
	}

	/**
	 * Returns the sub type (the part after the `/`) of the mime type.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Secondary part of the MIME type.
	 */
	public static getMimeSubtype(file: FileDocument, variation: FileVariation = null): string {
		return File.getMimeType(file, variation).split('/')[1];
	}

	/**
	 * Returns the file category.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	public static getMimeCategory(file: FileDocument, variation: FileVariation = null): string {
		return mimeTypes[File.getMimeType(file, variation)].category;
	}

	/**
	 * Returns something useful for logging.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} variation File variation or null for original file
	 * @returns {string}
	 */
	public static toShortString(file: FileDocument, variation: FileVariation = null): string {
		const color = variation ? chalk.underline : chalk.underline.bold;
		return color(file.file_type + ' "' + file.id + '"' + (variation ? ' (' + variation.name + ')' : ''));
	}

	/**
	 * Returns something even more useful for logging.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} variation File variation or null for original file
	 * @returns {string}
	 */
	public static toDetailedString(file: FileDocument, variation?: FileVariation): string {
		const color = variation ? chalk.underline : chalk.underline.bold;
		return color(file.file_type + '@' + File.getMimeType(file, variation) + ' "' + file.id + '"' + (variation ? ' (' + variation.name + ')' : ''));
	}

	/**
	 * Returns all variations that are stored in the database for this file.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @returns {FileVariation[]} Existing variations
	 */
	public static getExistingVariations(file: FileDocument): FileVariation[] {
		const variations: FileVariation[] = [];
		if (!file.variations) {
			return [];
		}
		for (const name of Object.keys(file.variations)) {
			variations.push({ name, mimeType: file.variations[name].mime_type });
		}
		return variations;
	}

	/**
	 * Returns all defined variations for this file.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @returns {FileVariation[]}
	 */
	public static getVariations(file: FileDocument): FileVariation[] {
		return fileTypes.getVariations(file.file_type, file.mime_type);
	}

	/**
	 * Checks whether a variation for the given file exists.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {string} variationName Name of the variation
	 * @returns {FileVariation | null} File variation or null if the variation doesn't exist.
	 */
	public static getVariation(file: FileDocument, variationName: string): FileVariation | null {
		return fileTypes.getVariation(file.file_type, file.mime_type, variationName);
	}

	/**
	 * Returns all direct dependencies of a variation.
	 *
	 * @param {FileDocument} file Potentially dehydrated file
	 * @param {FileVariation} variation Variation
	 * @returns {FileVariation[]} All variations that depend directly on the given variation.
	 */
	public static getDirectVariationDependencies(file: FileDocument, variation: FileVariation): FileVariation[] {
		return File.getVariations(file).filter(v => v.source === variation.name);
	}
}
