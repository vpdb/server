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
import { DragPoint } from './dragpoint';
import { GameItem } from './game-item';
import { Meshes } from './mesh';
import { Vertex2D } from './vertex';
import { VpTable } from './vp-table';

export class TriggerItem extends GameItem {

	public static ShapeTriggerNone = 0;
	public static ShapeTriggerWireA = 1;
	public static ShapeTriggerStar = 2;
	public static ShapeTriggerWireB = 3;
	public static ShapeTriggerButton = 4;
	public static ShapeTriggerWireC = 5;
	public static ShapeTriggerWireD = 6;

	public dragPoints: DragPoint[];
	private pdata: number;
	private vCenter: Vertex2D;
	private radius: number;
	private rotation: number;
	private wireThickness: number;
	private scaleX: number;
	private scaleY: number;
	private szMaterial: string;
	private fTimerEnabled: boolean;
	private TimerInterval: number;
	private szSurface: string;
	private fEnabled: boolean;
	private hitHeight: number;
	private fVisible: boolean;
	private fReflectionEnabled: boolean;
	private shape: number;
	private animSpeed: number;
	private wzName: string;

	public static async fromStorage(storage: Storage, itemName: string): Promise<TriggerItem> {
		const triggerItem = new TriggerItem();
		await storage.streamFiltered(itemName, 4, TriggerItem.createStreamHandler(triggerItem));
		return triggerItem;
	}

	public generateMeshes(table: VpTable): Meshes {

		const meshes: Meshes = {};
		return meshes;
	}

	public getName(): string {
		return this.wzName;
	}

	private static createStreamHandler(triggerItem: TriggerItem) {
		triggerItem.dragPoints = [];
		return BiffParser.stream(triggerItem.fromTag.bind(triggerItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => triggerItem.dragPoints.push(dragPoint),
				},
			},
		});
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.radius = this.getFloat(buffer); break;
			case 'ROTA': this.rotation = this.getFloat(buffer); break;
			case 'WITI': this.wireThickness = this.getFloat(buffer); break;
			case 'SCAX': this.scaleX = this.getFloat(buffer); break;
			case 'SCAY': this.scaleY = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'EBLD': this.fEnabled = this.getBool(buffer); break;
			case 'THOT': this.hitHeight = this.getFloat(buffer); break;
			case 'VSBL': this.fVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'SHAP': this.shape = this.getInt(buffer); break;
			case 'ANSP': this.animSpeed = this.getFloat(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
