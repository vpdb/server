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

import { Types } from 'mongoose';
import { differenceWith, uniqWith } from 'lodash';

import { state } from '../../state';
import { File } from '../file';
import { visualPinballTable } from '../../common/visualpinball.table';
import { TableBlock } from '../../releases/release.tableblock';
import { FileVariation, ImageFileVariation } from '../file.variations';
import { OptimizationProcessor } from './processor';
import { logger } from '../../common/logger';

export class VptBlockindexProcessor implements OptimizationProcessor<ImageFileVariation> {

	name: string = 'vpt.blockindex';

	canProcess(file: File, variation?: FileVariation): boolean {
		return file.getMimeCategory() === 'table';
	}

	getOrder(variation?: FileVariation): number {
		return 700 + (variation && variation.priority ? variation.priority : 0);
	}


	async process(file: File, src: string, dest: string, variation?: ImageFileVariation): Promise<string> {

		// retrieve unique blocks from file
		let fileBlocks = await visualPinballTable.analyzeFile(src);
		fileBlocks = uniqWith(fileBlocks, VptBlockindexProcessor.blockCompare);

		// retrieve identical blocks from database
		const dbBlocks = await state.models.TableBlock.find({ hash: { $in: fileBlocks.map(b => b.hash) } }).exec();

		// diff and insert new blocks into db
		const newBlocks = differenceWith(fileBlocks, dbBlocks, VptBlockindexProcessor.blockCompare);
		let numAdded = 0;
		for (let block of newBlocks) {
			let newBlock = new state.models.TableBlock(block);
			newBlock._files = [file._id];
			await newBlock.save();
			numAdded++;
		}

		// update available blocks
		let numUpdated = 0;
		for (let block of dbBlocks) {
			(block._files as Types.ObjectId[]).push(file._id);
			block._files = uniqWith(block._files, VptBlockindexProcessor.objectIdCompare);
			await block.save();
			numUpdated++;
		}
		logger.info('[VptBlockindexProcessor.process]: Added %s and updated %s table blocks.', numAdded, numUpdated);
		return null;
	}

	/**
	 * Compares the hashes of two blocks.
	 * @param {{ hash: Buffer }} b1
	 * @param {{ hash: Buffer }} b2
	 * @returns {boolean} True if hashes are equal, false otherwise.
	 */
	static blockCompare(b1: TableBlock, b2: TableBlock) {
		return b1.hash.equals(b2.hash);
	}

	static objectIdCompare(id1: any, id2: any) {
		return (id1.toString ? id1.toString() : id1) === (id2.toString ? id2.toString() : id2);
	}
}