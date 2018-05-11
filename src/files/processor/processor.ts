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

	abstract canProcess(file: File, variation?: FileVariation): boolean;

	abstract getQueue(): ProcessorQueue;

	abstract getPriority(variation?: FileVariation): number;

	abstract async process(file: File, src:string, dest:string, variation?: V): Promise<File>;
}

export enum ProcessorQueue {
	HI_PRIO_FAST,
	LOW_PRIO_SLOW
}