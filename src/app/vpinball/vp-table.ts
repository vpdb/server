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

import { logger } from '../common/logger';
import { OleCompoundDoc, Storage } from '../common/ole-doc';
import { settings } from '../common/settings';
import { BumperItem } from './bumper-item';
import { FlipperItem } from './flipper-item';
import { GameData } from './game-data';
import { GameItem } from './game-item';
import { GateItem } from './gate-item';
import { VpTableExporter } from './gltf/vp-table-exporter';
import { HitTargetItem } from './hit-target-item';
import { KickerItem } from './kicker-item';
import { LightItem } from './light-item';
import { Material } from './material';
import { PrimitiveItem } from './primitive-item';
import { RampItem } from './ramp-item';
import { RubberItem } from './rubber-item';
import { SurfaceItem } from './surface-item';
import { Texture } from './texture';
import { TriggerItem } from './trigger-item';

export class VpTable {

	private doc: OleCompoundDoc;

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
	public surfaces: { [key: string]: SurfaceItem } = {};
	public primitives: { [key: string]: PrimitiveItem } = {};
	public textures: { [key: string]: Texture } = {};
	public rubbers: { [key: string]: RubberItem } = {};
	public flippers: { [key: string]: FlipperItem } = {};
	public bumpers: { [key: string]: BumperItem } = {};
	public ramps: { [key: string]: RampItem } = {};
	public lights: LightItem[] = [];
	public hitTargets: HitTargetItem[] = [];
	public gates: GateItem[] = [];
	public kickers: KickerItem[] = [];
	public triggers: TriggerItem[] = [];

	public getPrimitive(name: string): PrimitiveItem {
		return this.primitives[name];
	}

	public getRubber(name: string): RubberItem {
		return this.rubbers[name];
	}

	public getTexture(name: string): Texture {
		return this.textures[name];
	}

	public getMaterial(name: string): Material {
		return this.gameData.materials.find(m => m.szName === name);
	}

	public getSurface(name: string): SurfaceItem {
		return this.surfaces[name];
	}

	public getScaleZ(): number {
		return this.gameData.BG_scalez[this.gameData.BG_current_set] || 1.0;
	}

	public getDetailLevel() {
		return 10; // todo check if true
	}

	public getTableHeight() {
		return this.gameData.tableheight;
	}

	public async getDocument(): Promise<OleCompoundDoc> {
		await this.doc.read();
		return this.doc;
	}

	public serialize(fileId: string) {
		return Object.assign({}, this.gameData.serialize(), {
			meshGlb: settings.apiExternalUri(`/v1/vp/${fileId}/objects.glb`),
			meshGltf: settings.apiExternalUri(`/v1/vp/${fileId}/objects.gltf`),
		});
		// return {
		// 	game_data: this.gameData.serialize(),
		// 	lights: this.lights.map(l => l.serialize()),
		// };
	}

	public getSurfaceHeight(surface: string, x: number, y: number) {
		if (!surface) {
			return this.gameData.tableheight;
		}

		if (this.surfaces[surface]) {
			return this.gameData.tableheight + this.surfaces[surface].heighttop;
		}

		// todo ramps
		// if (this.ramps[surface]) {
		// 	return this.gameData.tableheight + this.ramps[surface].getSurfaceHeight();
		// }
		logger.warn(null, '[VpTable.getSurfaceHeight] Unknown surface %s.', surface);
		return this.gameData.tableheight;
	}

	public async exportGltf(fileId: string): Promise<string> {
		const exporter = new VpTableExporter(this);
		return await exporter.exportGltf(fileId);
	}

	public async exportGlb(fileId: string): Promise<Buffer> {
		const exporter = new VpTableExporter(this);
		return await exporter.exportGlb(fileId);
	}

	private async _load(fileName: string): Promise<void> {

		this.doc = new OleCompoundDoc(fileName);

		try {

			// read ole-doc
			await this.doc.read();

			// open game storage
			const gameStorage = this.doc.storage('GameStg');

			// load game data
			this.gameData = await GameData.fromStorage(gameStorage, 'GameData');

			// load items
			const stats = await this.loadGameItems(gameStorage, this.gameData.numGameItems);

			// load images
			await this.loadTextures(gameStorage, this.gameData.numTextures);

			console.log(stats);

		} finally {
			await this.doc.close();
		}
	}

	private async loadGameItems(storage: Storage, numItems: number): Promise<{[key: string]: number}> {
		const stats: {[key: string]: number} = {};
		for (let i = 0; i < numItems; i++) {
			const itemName = `GameItem${i}`;
			const itemData = await storage.read(itemName, 0, 4);
			const itemType = itemData.readInt32LE(0);
			switch (itemType) {

				case GameItem.TypeSurface: {
					const item = await SurfaceItem.fromStorage(storage, itemName);
					this.surfaces[item.getName()] = item;
					break;
				}

				case GameItem.TypePrimitive: {
					const item = await PrimitiveItem.fromStorage(storage, itemName);
					this.primitives[item.getName()] = item;
					break;
				}

				case GameItem.TypeLight: {
					this.lights.push(await LightItem.fromStorage(storage, itemName));
					break;
				}

				case GameItem.TypeRubber: {
					const item = await RubberItem.fromStorage(storage, itemName);
					this.rubbers[item.getName()] = item;
					break;
				}

				case GameItem.TypeFlipper: {
					const item = await FlipperItem.fromStorage(storage, itemName);
					this.flippers[item.getName()] = item;
					break;
				}

				case GameItem.TypeBumper: {
					const item = await BumperItem.fromStorage(storage, itemName);
					this.bumpers[item.getName()] = item;
					break;
				}

				case GameItem.TypeRamp: {
					const item = await RampItem.fromStorage(storage, itemName);
					this.ramps[item.getName()] = item;
					break;
				}

				case GameItem.TypeHitTarget: {
					this.hitTargets.push(await HitTargetItem.fromStorage(storage, itemName));
					break;
				}

				case GameItem.TypeGate: {
					this.gates.push(await GateItem.fromStorage(storage, itemName));
					break;
				}

				case GameItem.TypeKicker: {
					this.kickers.push(await KickerItem.fromStorage(storage, itemName));
					break;
				}

				case GameItem.TypeTrigger: {
					this.triggers.push(await TriggerItem.fromStorage(storage, itemName));
					break;
				}

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
