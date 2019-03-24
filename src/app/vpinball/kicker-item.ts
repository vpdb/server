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

import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { GameItem } from './game-item';
import { Meshes } from './mesh';
import { Vertex2D } from './vertex';
import { VpTable } from './vp-table';

export class KickerItem extends GameItem {

	public static TypeKickerInvisible = 0;
	public static TypeKickerHole = 1;
	public static TypeKickerCup = 2;
	public static TypeKickerHoleSimple = 3;
	public static TypeKickerWilliams = 4;
	public static TypeKickerGottlieb = 5;
	public static TypeKickerCup2 = 6;

	private pdata: number;
	private kickerType: number;
	private vCenter: Vertex2D;
	private radius: number;
	private scatter: number;
	private hitAccuracy: number;
	private hitHeight: number;
	private orientation: number;
	private szMaterial: string;
	private fTimerEnabled: boolean;
	private fEnabled: boolean;
	private TimerInterval: number;
	private szSurface: string;
	private wzName: string;
	private fFallThrough: boolean;
	private legacyMode: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<KickerItem> {
		const kickerItem = new KickerItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(kickerItem.fromTag.bind(kickerItem), {}));
		return kickerItem;
	}

	public generateMeshes(table: VpTable): Meshes {

		const meshes: Meshes = {};
		return meshes;
	}

	public getName(): string {
		return this.wzName;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.radius = this.getFloat(buffer); break;
			case 'KSCT': this.scatter = this.getFloat(buffer); break;
			case 'KHAC': this.hitAccuracy = this.getFloat(buffer); break;
			case 'KHHI': this.hitHeight = this.getFloat(buffer); break;
			case 'KORI': this.orientation = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'EBLD': this.fEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'TYPE':
				this.kickerType = this.getInt(buffer);
				//legacy handling:
				if (this.kickerType > KickerItem.TypeKickerCup2) {
					this.kickerType = KickerItem.TypeKickerInvisible;
				}
				break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'FATH': this.fFallThrough = this.getBool(buffer); break;
			case 'LEMO': this.legacyMode = this.getBool(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
