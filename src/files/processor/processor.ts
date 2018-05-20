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


import { File} from '../file';
import { FileVariation } from '../file.variations';

export abstract class Processor<V extends FileVariation> {

	/**
	 * Checks whether the variation of the given file can be processed by this
	 * processor.
	 *
	 * @param {File} file File to check
	 * @param {FileVariation} variation Variation of the file to check, original if not set.
	 * @returns {boolean} True if it can be processed, false otherwise.
	 */
	abstract canProcess(file: File, variation?: FileVariation): boolean;

	/**
	 * Returns the type of queue the processor should be run under.
	 *
	 * @returns {ProcessorQueue}
	 */
	abstract getQueue(): ProcessorQueue;

	/**
	 * Returns a number indicating the order of execution of this processor.
	 *
	 * This is needed to define an order for multiple processors, but it can also
	 * be used to prefer some variations to others.
	 *
	 * @param {FileVariation} variation Variation of the file to process, or original if not set.
	 * @returns {number} Order of processing
	 */
	abstract getOrder(variation?: FileVariation): number;

	/**
	 * Starts processing the file. This is executed in Bull.
	 *
	 * @param {File} file File to process
	 * @param {string} src Source path of the file
	 * @param {string} dest Destination path
	 * @param variation Variation to process
	 * @returns {Promise<File>}
	 */
	abstract async process(file: File, src:string, dest:string, variation?: V): Promise<File>;
}

export enum ProcessorQueue {
	HI_PRIO_FAST,
	LOW_PRIO_SLOW
}