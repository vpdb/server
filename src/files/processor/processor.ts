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

/**
 * A processor takes in a physical file and produces or updates an optional
 * variation of it.
 *
 * It's the processor deciding if it applies to a given file or variation, and
 * it's also the processor deciding which queue to use. Furthermore, it can
 * indicate the processing order within the queue based on the file or
 * variation.
 *
 * Note that processors are singletons and don't contain any file- or variation
 * specific state.
 */
export interface Processor<V extends FileVariation> {

	/**
	 * Filename of the processor without "processor" suffix, e.g. "image.optimization".
	 */
	name: string;

	/**
	 * Returns a number indicating the order of execution of this processor.
	 *
	 * This is needed to define an order for multiple processors, but it can also
	 * be used to prefer some variations to others.
	 *
	 * @param {FileVariation} variation Variation of the source file to process, or original if not set.
	 * @returns {number} Order of processing
	 */
	getOrder(variation?: FileVariation): number;

	/**
	 * Starts processing the file. This is executed in Bull's worker thread.
	 *
	 * @param {File} file File to process
	 * @param {string} src Source path of the file
	 * @param {string} dest Destination path
	 * @param variation Variation to process
	 * @returns {Promise<string>} Path to processed file
	 */
	process(file: File, src: string, dest: string, variation?: V): Promise<string>;
}

export interface CreationProcessor<V extends FileVariation> extends Processor<V> {

	/**
	 * Checks whether the variation of the given file can be processed by this
	 * processor.
	 *
	 * @param {File} file File to check
	 * @param {FileVariation} srcVariation Variation of source file to process, original if null.
	 * @param {FileVariation} destVariation Variation of destination file to process
	 * @returns {boolean} True if it can be processed, false otherwise.
	 */
	canProcess(file: File, srcVariation: FileVariation, destVariation: FileVariation): boolean;
}

export interface OptimizationProcessor<V extends FileVariation> extends Processor<V> {

	/**
	 * Checks whether the variation of the given file can be processed by this
	 * processor.
	 *
	 * @param {File} file File to check
	 * @param {FileVariation} variation Variation to process, original if not set.
	 * @returns {boolean} True if it can be processed, false otherwise.
	 */
	canProcess(file: File, variation?: FileVariation): boolean;
}
