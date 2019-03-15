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

import { values } from 'lodash';
import { logger } from '../common/logger';
import { OleCompoundDoc, Storage } from '../common/ole-doc';
import { GameData } from './game-data';
import { GameItem } from './game-item';
import { LightItem } from './light-item';
import { PrimitiveItem } from './primitive-item';
import { Texture } from './texture';

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
		vpTable.gameData = GameData.from(data.gameData);
		for (const name of Object.keys(data.primitives)) {
			vpTable.primitives[name] = PrimitiveItem.from(data.primitives[name]);
		}
		for (const name of Object.keys(data.textures)) {
			vpTable.textures[name] = Texture.from(data.textures[name]);
		}
		vpTable.lights = data.lights.map((light: any) => LightItem.from(light));
		return vpTable;
	}

	public gameData: GameData;
	public primitives: { [key: string]: PrimitiveItem } = {};
	public textures: { [key: string]: Texture } = {};
	public lights: LightItem[] = [];

	public getPrimitive(name: string): PrimitiveItem {
		return this.primitives[name];
	}

	public getTexture(name: string): Texture {
		return this.textures[name];
	}

	public serialize(fileId: string) {
		return {
			game_data: this.gameData.serialize(),
			primitives: values(this.primitives).map((p: PrimitiveItem) => p.serialize(fileId)),
			textures: Object.keys(this.textures).reduce<{ [key: string]: any }>((textures, textureName) => {
				textures[textureName] = this.textures[textureName].serialize(fileId);
				return textures;
			}, {}),
			materials: this.gameData.materials.reduce<{ [key: string]: any }>((materials, material) => {
				materials[material.szName] = material.serialize();
				return materials;
			}, {}),
			lights: this.lights.map(l => l.serialize()),
		};
	}

	private async _load(fileName: string): Promise<void> {

		const doc = new OleCompoundDoc(fileName);

		try {

			// read ole-doc
			await doc.read();

			// open game storage
			const gameStorage = doc.storage('GameStg');

			// load game data
			this.gameData = await GameData.fromStorage(gameStorage, 'GameData');

			// load items
			const stats = await this.loadGameItems(gameStorage, this.gameData.numGameItems);

			// load images
			await this.loadTextures(gameStorage, this.gameData.numTextures);

			console.log(stats);

		} finally {
			await doc.close();
		}
	}

	private async loadGameItems(storage: Storage, numItems: number): Promise<{[key: string]: number}> {
		const stats: {[key: string]: number} = {};
		for (let i = 0; i < numItems; i++) {
			const itemName = `GameItem${i}`;
			const itemData = await storage.read(itemName, 0, 4);
			const itemType = itemData.readInt32LE(0);
			switch (itemType) {
				case GameItem.TypePrimitive:
					const item = await PrimitiveItem.fromStorage(storage, itemName);
					this.primitives[item.getName()] = item;
					//console.log('Adding primitive %s (%s bytes)', item.getName(), itemData.length);
					break;

				case GameItem.TypeLight:
					this.lights.push(await LightItem.fromStorage(storage, itemName));
					break;

				default:
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

	private async loadTextures(storage: Storage, numItems: number): Promise<void> {
		for (let i = 0; i < numItems; i++) {
			const itemName = `Image${i}`;
			const texture = await Texture.fromStorage(storage, itemName);
			this.textures[texture.getName()] = texture;
		}
	}
}
