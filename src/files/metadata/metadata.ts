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

export interface Metadata {

	/**
	 * Checks if the metadata class can be applied to a given file.
	 *
	 * @param {File} file File to check
	 * @param {FileVariation} [variation] Variation to check
	 * @return {boolean}
	 */
	isValid(file: File, variation?: FileVariation): boolean;

	/**
	 * Reads the metadata from the file.
	 *
	 * @param {File} file File to read
	 * @param {FileVariation} [variation] Variation of the file to read
	 * @return Full metadata
	 */
	getMetadata(file: File, variation?: FileVariation): Promise<{ [key: string]: any }>;

	/**
	 * This is what's returned in the detail view of the file
	 * @param metadata Full metadata
	 * @return Subset for detailed view
	 */
	serializeDetailed(metadata: { [key: string]: any }): { [key: string]: any };

	/**
	 * This is what's returned in the variation view of the file. Pure minimum.
	 * @param metadata Full metadata
	 * @return Subset for reduced view
	 */
	serializeVariation(metadata: { [key: string]: any }): { [key: string]: any };
}
