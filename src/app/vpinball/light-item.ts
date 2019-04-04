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
import { GameItem, IRenderable, Meshes } from './game-item';
import { Material } from './material';
import { Matrix3D } from './matrix3d';
import { bulbLightMesh } from './meshes/bulb-light-mesh';
import { bulbSocketMesh } from './meshes/bulb-socket-mesh';
import { Vertex2D } from './vertex';
import { VpTable } from './vp-table';

/**
 * VPinball's lights.
 *
 * @see https://github.com/vpinball/vpinball/blob/master/light.cpp
 */
export class LightItem extends GameItem implements IRenderable {

	public static readonly StateOff = 0;
	public static readonly StateOn = 1;
	public static readonly StateBlinking = 2;

	public wzName: string;
	public pdata: number;
	public vCenter: Vertex2D;
	public falloff: number = 50;
	public falloffPower: number = 2;
	public state: number = LightItem.StateOff;
	public color: number = 0xffff00;
	public color2: number = 0xffffff;
	public szOffImage: string;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public roundLight: boolean;
	public rgblinkpattern: string;
	public blinkinterval: number = 125;
	public intensity: number = 1;
	public transmissionScale: number = 0;
	public szSurface: string;
	public fBackglass: boolean;
	public depthBias: number;
	public fadeSpeedUp: number = 0.2;
	public fadeSpeedDown: number = 0.2;
	public BulbLight: boolean = false;
	public imageMode: boolean = false;
	public showBulbMesh: boolean = false;
	public staticBulbMesh: boolean = false;
	public showReflectionOnBall: boolean = true;
	public meshRadius: number = 20;
	public modulateVsAdd: number = 0.9;
	public bulbHaloHeight: number = 28;
	public dragPoints: DragPoint[];

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

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.showBulbMesh;
	}

	public getMeshes(table: VpTable): Meshes {
		const lightMesh = bulbLightMesh.clone(`bulb:light:${this.getName()}`);
		const height = table.getSurfaceHeight(this.szSurface, this.vCenter.x, this.vCenter.y) * table.getScaleZ();
		for (const vertex of lightMesh.vertices) {
			vertex.x = vertex.x * this.meshRadius + this.vCenter.x;
			vertex.y = vertex.y * this.meshRadius + this.vCenter.y;
			vertex.z = vertex.z * this.meshRadius * table.getScaleZ() + height;
		}

		const socketMesh = bulbSocketMesh.clone(`bulb:socket:${this.getName()}`);
		for (const vertex of socketMesh.vertices) {
			vertex.x = vertex.x * this.meshRadius + this.vCenter.x;
			vertex.y = vertex.y * this.meshRadius + this.vCenter.y;
			vertex.z = vertex.z * this.meshRadius * table.getScaleZ() + height;
		}

		const lightMaterial = new Material();
		lightMaterial.cBase = 0;
		lightMaterial.fWrapLighting = 0.5;
		lightMaterial.bOpacityActive = true;
		lightMaterial.fOpacity = 0.2;
		lightMaterial.cGlossy = 0xFFFFFF;
		lightMaterial.bIsMetal = false;
		lightMaterial.fEdge = 1.0;
		lightMaterial.fEdgeAlpha = 1.0;
		lightMaterial.fRoughness = 0.9;
		lightMaterial.fGlossyImageLerp = 1.0;
		lightMaterial.fThickness = 0.05;
		lightMaterial.cClearcoat = 0xFFFFFF;

		const socketMaterial = new Material();
		socketMaterial.cBase = 0x181818;
		socketMaterial.fWrapLighting = 0.5;
		socketMaterial.bOpacityActive = false;
		socketMaterial.fOpacity = 1.0;
		socketMaterial.cGlossy = 0xB4B4B4;
		socketMaterial.bIsMetal = false;
		socketMaterial.fEdge = 1.0;
		socketMaterial.fEdgeAlpha = 1.0;
		socketMaterial.fRoughness = 0.9;
		socketMaterial.fGlossyImageLerp = 1.0;
		socketMaterial.fThickness = 0.05;
		socketMaterial.cClearcoat = 0;

		return {
			light: {
				mesh: lightMesh.transform(new Matrix3D().toRightHanded()),
				material: lightMaterial,
			},
			socket: {
				mesh: socketMesh.transform(new Matrix3D().toRightHanded()),
				material: socketMaterial,
			},
		};
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

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
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
		return 0;
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
}

