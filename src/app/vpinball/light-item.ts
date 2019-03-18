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
import { Vertex2D } from './common';
import { DragPoint } from './dragpoint';
import { GameItem } from './game-item';

export class LightItem extends GameItem {

	public static async fromStorage(storage: Storage, itemName: string): Promise<LightItem> {
		const lightItem = new LightItem();
		await storage.streamFiltered(itemName, 4, LightItem.createStreamHandler(lightItem));
		return lightItem;
	}

	public static from(data: any): LightItem {
		const lightItem = new LightItem();
		Object.assign(lightItem, data);
		return lightItem;
	}

	private static createStreamHandler(lightItem: LightItem) {
		lightItem.dragPoints = [];
		return BiffParser.stream(lightItem.fromTag.bind(lightItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => lightItem.dragPoints.push(dragPoint),
				},
			},
		});
	}

	public wzName: string;
	public pdata: number;
	public vCenter: Vertex2D;
	public falloff: number;
	public falloffPower: number;
	public state: number;
	public color: number;
	public color2: number;
	public szOffImage: string;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public roundLight: boolean;
	public rgblinkpattern: string;
	public blinkinterval: number;
	public intensity: number;
	public transmissionScale: number;
	public szSurface: string;
	public fBackglass: boolean;
	public depthBias: number;
	public fadeSpeedUp: number;
	public fadeSpeedDown: number;
	public BulbLight: boolean;
	public imageMode: boolean;
	public showBulbMesh: boolean;
	public staticBulbMesh: boolean;
	public showReflectionOnBall: boolean;
	public meshRadius: number;
	public modulateVsAdd: number;
	public bulbHaloHeight: number;
	public dragPoints: DragPoint[];

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public serialize() {
		return {
			name: this.wzName,
			center: this.vCenter,
			intensity: this.intensity,
			color: this.color,
			falloff: this.falloff,
			mesh: this.showBulbMesh ? settings.apiExternalUri(`/v1/meshes/bulbLightMess.obj`) : undefined,
			meshRadius: this.meshRadius,
		};
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.falloff = this.getFloat(buffer); break;
			case 'FAPO': this.falloffPower = this.getFloat(buffer); break;
			case 'STAT': this.state = this.getInt(buffer); break;
			case 'COLR': this.color = BiffParser.bgrToRgb(this.getInt(buffer)); break;
			case 'COL2': this.color2 = BiffParser.bgrToRgb(this.getInt(buffer)); break;
			case 'IMG1': this.szOffImage = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SHAP': this.roundLight = this.getBool(buffer); break;
			case 'BPAT': this.rgblinkpattern = this.getString(buffer, len); break;
			case 'BINT': this.blinkinterval = this.getInt(buffer); break;
			case 'BWTH': this.intensity = this.getFloat(buffer); break;
			case 'TRMS': this.transmissionScale = this.getFloat(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'BGLS': this.fBackglass = this.getBool(buffer); break;
			case 'LIDB': this.depthBias = this.getFloat(buffer); break;
			case 'FASP': this.fadeSpeedUp = this.getFloat(buffer); break;
			case 'FASD': this.fadeSpeedDown = this.getFloat(buffer); break;
			case 'BULT': this.BulbLight = this.getBool(buffer); break;
			case 'IMMO': this.imageMode = this.getBool(buffer); break;
			case 'SHBM': this.showBulbMesh = this.getBool(buffer); break;
			case 'STBM': this.staticBulbMesh = this.getBool(buffer); break;
			case 'SHRB': this.showReflectionOnBall = this.getBool(buffer); break;
			case 'BMSC': this.meshRadius = this.getFloat(buffer); break;
			case 'BMVA': this.modulateVsAdd = this.getFloat(buffer); break;
			case 'BHHI': this.bulbHaloHeight = this.getFloat(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
