/* tslint:disable:no-console */
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

import { isUndefined, values } from 'lodash';
import { logger } from '../common/logger';
import { OleCompoundDoc, Storage } from '../common/ole-doc';
import { BiffBlock, BiffParser } from './biff-parser';
import { GameItem } from './game-item';
import { PintableItem } from './pintable-item';
import { PrimitiveItem } from './primitive-item';

export class VpTable {

	public static async load(fileName: string): Promise<VpTable> {
		const then = Date.now();
		const vpTable = new VpTable();
		await vpTable._load(fileName);
		logger.info(null, '[VpTable.load] Table loaded in %sms.', Date.now() - then);
		return vpTable;
	}

	public static from(data: any): VpTable {
		const vpTable = new VpTable();
		for (const name of Object.keys(data.primitives)) {
			vpTable.primitives[name] = PrimitiveItem.from(data.primitives[name]);
		}
		return vpTable;
	}

	private table: PintableItem;
	private primitives: { [key: string]: PrimitiveItem } = {};

	public getPrimitive(name: string): PrimitiveItem {
		return this.primitives[name];
	}

	public getTableInfo() {
		return this.table;
	}

	public serialize(fileId: string) {
		return {
			primitives: values(this.primitives).map((p: PrimitiveItem) => p.serialize(fileId)),
		};
	}

	private async _load(fileName: string): Promise<void> {

		// read ole-doc
		const doc = new OleCompoundDoc(fileName);
		await doc.read();

		// open game storage
		const gameStorage = doc.storage('GameStg');

		// get number of items from game data
		const blocks = BiffParser.parseBiff(await gameStorage.read('GameData'));
		const gameData = this.parseGameData(blocks);

		// load items
		const stats = await this.loadGameItems(gameStorage, gameData.numGameItems);

		console.log(stats);
	}

	private async loadGameItems(storage: Storage, numItems: number): Promise<{[key: string]: number}> {
		const stats: {[key: string]: number} = {};
		for (let i = 0; i < numItems; i++) {
			const itemName = `GameItem${i}`;
			const itemData = await storage.read(itemName);
			const itemType = itemData.readInt32LE(0);
			switch (itemType) {
				case GameItem.TypePrimitive:
					const item = await PrimitiveItem.load(itemData);
					this.primitives[item.getName()] = item;
					console.log('Adding primitive %s (%s bytes)', item.getName(), itemData.length);
					break;

				case GameItem.TypeTable:
					if (this.table) {
						throw new Error('Already got table data!');
					}
					console.log('Adding table infos (%s bytes)', itemData.length);
					this.table = await PintableItem.load(itemData);
					break;

				default:
					console.log('Ignoring type %s', itemType);
					// ignore the rest for now
					break;
			}
			if (!stats[GameItem.getType(itemType)]) {
				stats[GameItem.getType(itemType)] = 1;
			} else {
				stats[GameItem.getType(itemType)]++;
			}
		}
		return stats;
	}

	/**
	 * Parses the stream counters and table script from the "GameData" stream.
	 *
	 * @param {Block[]} blocks "GameData" blocks
	 * @return {GameDataItem} GameData values
	 */
	private parseGameData(blocks: BiffBlock[]): GameData {
		const gameData: GameData = {};
		for (const block of blocks) {
			switch (block.tag) {
				case 'SEDT':
					if (isUndefined(gameData.numGameItems)) {
						gameData.numGameItems = block.data.readInt32LE(0);
					}
					break;
				case 'SSND':
					if (isUndefined(gameData.numSounds)) {
						gameData.numSounds = block.data.readInt32LE(0);
					}
					break;
				case 'SIMG':
					if (isUndefined(gameData.numTextures)) {
						gameData.numTextures = block.data.readInt32LE(0);
					}
					break;
				case 'SFNT':
					if (isUndefined(gameData.numFonts)) {
						gameData.numFonts = block.data.readInt32LE(0);
					}
					break;
				case 'SCOL':
					if (isUndefined(gameData.numCollections)) {
						gameData.numCollections = block.data.readInt32LE(0);
					}
					break;
				case 'CODE':
					if (isUndefined(gameData.script)) {
						gameData.script = block.data.toString('utf8');
					}
					break;
			}
		}
		return gameData;
	}
}

interface GameData {
	numGameItems?: number;
	numSounds?: number;
	numTextures?: number;
	numFonts?: number;
	numCollections?: number;
	collections?: number;
	script?: string;
}
