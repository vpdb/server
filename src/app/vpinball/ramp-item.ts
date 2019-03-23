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
import { settings } from '../common/settings';
import { BiffParser } from './biff-parser';
import { DragPoint } from './dragpoint';
import { GameItem } from './game-item';
import { Mesh } from './mesh';
import { bulbLightMesh } from './meshes/bulb-light-mesh';
import { bulbSocketMesh } from './meshes/bulb-socket-mesh';
import { Vertex2D } from './vertex';
import { VpTable } from './vp-table';
import { LightItem } from './light-item';

export class RampItem extends GameItem {

	public wzName: string;
	public dragPoints: DragPoint[];
	public pdata: number;
	public heightbottom: number;
	public heighttop: number;
	public widthbottom: number;
	public widthtop: number;
	public szMaterial: string;
	public fTimerEnabled: number;
	public TimerInterval: number;
	public rampType: number;
	public szImage: string;
	public imagealignment: number;
	public fImageWalls: boolean;
	public leftwallheight: number;
	public rightwallheight: number;
	public leftwallheightvisible: number;
	public rightwallheightvisible: number;
	public fHitEvent: boolean;
	public threshold: number;
	public elasticity: number;
	public friction: number;
	public scatter: number;
	public fCollidable: boolean;
	public fVisible: boolean;
	public fReflectionEnabled: boolean;
	public depthBias: number;
	public wireDiameter: number;
	public wireDistanceX: number;
	public wireDistanceY: number;
	public szPhysicsMaterial: string;
	public fOverwritePhysics: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<RampItem> {
		const rampItem = new RampItem();
		await storage.streamFiltered(itemName, 4, RampItem.createStreamHandler(rampItem));
		return rampItem;
	}

	public static from(data: any): RampItem {
		const rampItem = new RampItem();
		Object.assign(rampItem, data);
		return rampItem;
	}

	private static createStreamHandler(rampItem: RampItem) {
		rampItem.dragPoints = [];
		return BiffParser.stream(rampItem.fromTag.bind(rampItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => rampItem.dragPoints.push(dragPoint),
				},
			},
		});
	}

	public getName(): string {
		return this.wzName;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'HTBT': this.heightbottom = this.getFloat(buffer); break;
			case 'HTTP': this.heighttop = this.getFloat(buffer); break;
			case 'WDBT': this.widthbottom = this.getFloat(buffer); break;
			case 'WDTP': this.widthtop = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getInt(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'TYPE': this.rampType = this.getInt(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			case 'ALGN': this.imagealignment = this.getInt(buffer); break;
			case 'IMGW': this.fImageWalls = this.getBool(buffer); break;
			case 'NAME': this.wzName = this.getString(buffer, len); break;
			case 'WLHL': this.leftwallheight = this.getFloat(buffer); break;
			case 'WLHR': this.rightwallheight = this.getFloat(buffer); break;
			case 'WVHL': this.leftwallheightvisible = this.getFloat(buffer); break;
			case 'WVHR': this.rightwallheightvisible = this.getFloat(buffer); break;
			case 'HTEV': this.fHitEvent = this.getBool(buffer); break;
			case 'THRS': this.threshold = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'RFCT': this.friction = this.getFloat(buffer); break;
			case 'RSCT': this.scatter = this.getFloat(buffer); break;
			case 'CLDRP': this.fCollidable = this.getBool(buffer); break;
			case 'RVIS': this.fVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'RADB': this.depthBias = this.getFloat(buffer); break;
			case 'RADI': this.wireDiameter = this.getFloat(buffer); break;
			case 'RADX': this.wireDistanceX = this.getFloat(buffer); break;
			case 'RADY': this.wireDistanceY = this.getFloat(buffer); break;
			case 'MAPH': this.szPhysicsMaterial = this.getString(buffer, len); break;
			case 'OVPH': this.fOverwritePhysics = this.getBool(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
