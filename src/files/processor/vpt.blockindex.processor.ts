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

///<reference path="processor.ts"/>


import { differenceWith, uniqWith } from 'lodash';

import { OptimizationProcessor } from './processor';
import { File } from '../file';
import { FileVariation, ImageFileVariation } from '../file.variations';
import { visualPinballTable } from '../../common/visualpinball.table';
import { state } from '../../state';
import { Schema } from 'mongoose';
import { TableBlock } from '../../releases/release.tableblock';

export class VptBlockindexProcessor implements OptimizationProcessor<ImageFileVariation> {

	name: string = 'vpt.blockindex';

	canProcess(file: File, variation?: FileVariation): boolean {
		return ['application/x-visual-pinball-table', 'application/x-visual-pinball-table-x']
			.includes(file.getMimeType(variation));
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
		for (let block of newBlocks) {
			let newBlock = new state.models.TableBlock(block);
			newBlock._files = [file._id];
			await newBlock.save();
		}

		// update available blocks
		for (let block of dbBlocks) {
			(block._files as Schema.Types.ObjectId[]).push(file._id);
			block._files = uniqWith(block._files, VptBlockindexProcessor.objectIdCompare);
			await block.save();
		}
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