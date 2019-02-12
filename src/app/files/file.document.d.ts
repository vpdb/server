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

import { MetricsDocument, Types } from 'mongoose';
import { RequestState } from '../common/typings/context';
import { UserDocument } from '../users/user.document';
import { FileVariation } from './file.variations';

export interface FileDocument extends MetricsDocument {
	id: string;
	name: string;
	bytes: number;
	mime_type: string; // todo add enum
	file_type: string; // todo add enum
	metadata: any;
	variations: { [key: string]: any };  // todo type
	preprocessed: { // currently rotation settings of playfield images
		rotation?: number,
		unvalidatedRotation?: number,
	};
	is_active: boolean;
	counter: { [T in FileCounterType]: number; };
	created_at: Date;
	_created_by: UserDocument | Types.ObjectId;

	cost?: number;
	url?: string;
	is_protected?: boolean;

	/**
	 * Returns the local path where the file is stored.
	 *
	 * Note that this is to *construct* the file name, and doesn't mean that the
	 * file actually exists at the given location.
	 *
	 * @see [[File.getPath]] for implementation
	 * @param requestState For logging
	 * @param {FileVariation} [variation] If set, return given file variation.
	 * @param {FilePathOptions} [opts] Path options
	 * @return {string} Absolute path to storage
	 */
	getPath(requestState: RequestState, variation?: FileVariation, opts?: FilePathOptions): string;

	/**
	 * Returns the file extension, inclusively the dot.
	 *
	 * @see [[File.getExt]] for implementation
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
	 * @see [[File.getUrl]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	getUrl(variation?: FileVariation): string;

	/**
	 * Returns true if the file is public (as in accessible without being authenticated), false otherwise.
	 *
	 * @see [[File.isPublic]] for implementation
	 * @param requestState For logging
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean}
	 */
	isPublic(requestState: RequestState, variation?: FileVariation): boolean;

	/**
	 *  Returns true if the file is free (as in doesn't cost any credit), false otherwise.
	 *
	 * @see [[File.isFree]] for implementation
	 * @param requestState For logging
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {boolean} True if free, false otherwise.
	 */
	isFree(requestState: RequestState, variation?: FileVariation): boolean;

	/**
	 * Returns the MIME type for a given variation (or for the main file if not specified).
	 *
	 * @see [[File.getMimeType]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} MIME type of the file or its variation.
	 */
	getMimeType(variation?: FileVariation): string;

	/**
	 * Returns the "primary" type (the part before the `/`) of the mime type, e.g. `image`.
	 *
	 * @see [[File.getMimeTypePrimary]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Primary part of the MIME type.
	 */
	getMimeTypePrimary(variation?: FileVariation): string;

	/**
	 * Returns the sub type (the part after the `/`) of the mime type, e.g. `x-visual-pinball-table`.
	 *
	 * @see [[File.getMimeSubtype]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string} Secondary part of the MIME type.
	 */
	getMimeSubtype(variation?: FileVariation): string;

	/**
	 * Returns the file category.
	 *
	 * @see [[File.getMimeCategory]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @return {string}
	 */
	getMimeCategory(variation?: FileVariation): string;

	/**
	 * Switches a files from inactive to active and moves it to the public folder if necessary.
	 *
	 * This is the only method implemented directly in the schema.
	 * @return {Promise<File>} Moved file
	 */
	switchToActive(requestState: RequestState): Promise<FileDocument>;

	/**
	 * Returns all variations that are stored in the database for this file.
	 *
	 * @see [[File.getExistingVariations]] for implementation
	 * @returns {FileVariation[]} Existing variations
	 */
	getExistingVariations(): FileVariation[];

	/**
	 * Returns all defined variations for this file.
	 *
	 * @see [[File.getVariations]] for implementation
	 * @returns {FileVariation[]}
	 */
	getVariations(): FileVariation[];

	/**
	 * Checks whether a variation for the given file exists.
	 *
	 * @see [[File.getVariation]] for implementation
	 * @param {string} variationName Name of the variation
	 * @returns {FileVariation | null} File variation or null if the variation doesn't exist.
	 */
	getVariation(variationName: string): FileVariation | null;

	/**
	 * Returns all direct dependencies of a variation.
	 *
	 * @see [[File.getDirectVariationDependencies]] for implementation
	 * @param {FileVariation} variation Variation
	 * @returns {FileVariation[]} All variations that depend directly on the given variation.
	 */
	getDirectVariationDependencies(variation: FileVariation): FileVariation[];

	/**
	 * Returns something useful for logging.
	 *
	 * @see [[File.toShortString]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @returns {string}
	 */
	toShortString(variation?: FileVariation): string;

	/**
	 * Returns something even more useful for logging.
	 *
	 * @see [[File.toDetailedString]] for implementation
	 * @param {FileVariation} [variation] File variation or null for original file
	 * @returns {string}
	 */
	toDetailedString(variation?: FileVariation): string;
}

export type FileCounterType = 'downloads';

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
