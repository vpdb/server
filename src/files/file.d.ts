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

import { MetricsDocument, Schema } from 'mongoose';
import { User } from '../users/user';
import { FileVariation } from './file.variations';
import { fileSchema } from './file.schema';
import { fileTypes } from './file.types';

export interface File extends MetricsDocument {
	id: string;
	name: string;
	bytes: number;
	mime_type: string; // todo add enum
	file_type: string; // todo add enum
	metadata: any;
	variations: { [key: string]: any };  // todo type
	preprocessed: any; // todo wtf is that
	is_active: boolean;
	counter: { downloads: number };
	created_at: Date;
	_created_by: User | Schema.Types.ObjectId;

	cost?: number;
	url?: string;
	is_protected?: boolean;

	/**
	 * Returns the local path where the file is stored.
	 *
	 * Note that this is to *construct* the file name, and doesn't mean that the
	 * file actually exists at the given location.
	 *
	 * @param {FileVariation} [variation] If set, return given file variation.
	 * @param {FilePathOptions} [opts] Path options
	 * @return {string} Absolute path to storage
	 */
	getPath(variation?: FileVariation, opts?: FilePathOptions): string;

	/**
	 * Returns the file extension, inclusively the dot.
	 *
	 * @param {FileVariation} [variation] File variation
	 * @return {string} File extension
	 */
	getExt(variation?: FileVariation): string;

	/**
	 * Returns the public URL of the file.
	 *
	 * Note that the URL can change whether the file is protected or not.
	 * Typically a release file is protected during release upload and becomes
	 * public only after submission.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	getUrl(variation?: FileVariation): string;

	/**
	 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean}
	 */
	isPublic(variation?: FileVariation): boolean;

	/**
	 *  Returns true if the file is free (as in doesn't cost any credit), false otherwise.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean} True if free, false otherwise.
	 */
	isFree(variation?: FileVariation): boolean;

	/**
	 * Returns the MIME type for a given variation (or for the main file if not specified).
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} MIME type of the file or its variation.
	 */
	getMimeType(variation?: FileVariation): string;

	/**
	 * Returns the "primary" type (the part before the `/`) of the mime type, e.g. `image`.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Primary part of the MIME type.
	 */
	getMimeTypePrimary(variation?: FileVariation): string;

	/**
	 * Returns the sub type (the part after the `/`) of the mime type, e.g. `x-visual-pinball-table`.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Secondary part of the MIME type.
	 */
	getMimeSubtype(variation?: FileVariation): string;

	/**
	 * Returns the file category.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	getMimeCategory(variation?: FileVariation): string;

	/**
	 * Switches a files from inactive to active and moves it to the public folder if necessary.
	 *
	 * @return {Promise<File>} Moved file
	 */
	switchToActive(): Promise<File>;

	/**
	 * Returns all variations that are stored in the database for this file.
	 *
	 * @returns {FileVariation[]} Existing variations
	 */
	getExistingVariations(): FileVariation[];

	/**
	 * Returns all defined variations for this file.
	 *
	 * @returns {FileVariation[]}
	 */
	getVariations(): FileVariation[];

	/**
	 * Returns something useful for logging.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @returns {string}
	 */
	toString(variation?: FileVariation): string;

	/**
	 * Returns something even more useful for logging.
	 *
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @returns {string}
	 */
	toDetailedString(variation?:FileVariation): string;
}

export interface FilePathOptions {
	/**
	 * A suffix that is added to the file name
	 */
	tmpSuffix?: string;

	/**
	 * If true, always return the protected storage location,
	 */
	forceProtected?: boolean;
}