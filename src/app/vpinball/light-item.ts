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

import { BiffParser } from './biff-parser';
import { Vertex2D } from './common';
import { GameItem } from './game-item';
import { settings } from '../common/settings';

export class LightItem extends GameItem {

	public static async load(buffer: Buffer): Promise<LightItem> {
		const lightItem = new LightItem();
		await lightItem._load(buffer);
		return lightItem;
	}

	public static from(data: any): LightItem {
		const lightItem = new LightItem();
		Object.assign(lightItem, data);
		return lightItem;
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

	private async _load(buffer: Buffer) {
		const blocks = BiffParser.parseBiff(buffer, 4);
		for (const block of blocks) {
			switch (block.tag) {
				case 'PIID': this.pdata = this.parseInt(buffer, block); break;
				case 'VCEN': this.vCenter = Vertex2D.load(buffer, block); break;
				case 'RADI': this.falloff = this.parseFloat(buffer, block); break;
				case 'FAPO': this.falloffPower = this.parseFloat(buffer, block); break;
				case 'STAT': this.state = this.parseInt(buffer, block); break;
				case 'COLR': this.color = this.parseInt(buffer, block); break;
				case 'COL2': this.color2 = this.parseInt(buffer, block); break;
				case 'IMG1': this.szOffImage = this.parseString(buffer, block, 4); break;
				case 'TMON': this.fTimerEnabled = this.parseBool(buffer, block); break;
				case 'TMIN': this.TimerInterval = this.parseInt(buffer, block); break;
				case 'SHAP': this.roundLight = this.parseBool(buffer, block); break;
				case 'BPAT': this.rgblinkpattern = this.parseString(buffer, block, 4); break;
				case 'BINT': this.blinkinterval = this.parseInt(buffer, block); break;
				case 'BWTH': this.intensity = this.parseFloat(buffer, block); break;
				case 'TRMS': this.transmissionScale = this.parseFloat(buffer, block); break;
				case 'SURF': this.szSurface = this.parseString(buffer, block, 4); break;
				case 'NAME': this.wzName = this.parseWideString(buffer, block); break;
				case 'BGLS': this.fBackglass = this.parseBool(buffer, block); break;
				case 'LIDB': this.depthBias = this.parseFloat(buffer, block); break;
				case 'FASP': this.fadeSpeedUp = this.parseFloat(buffer, block); break;
				case 'FASD': this.fadeSpeedDown = this.parseFloat(buffer, block); break;
				case 'BULT': this.BulbLight = this.parseBool(buffer, block); break;
				case 'IMMO': this.imageMode = this.parseBool(buffer, block); break;
				case 'SHBM': this.showBulbMesh = this.parseBool(buffer, block); break;
				case 'STBM': this.staticBulbMesh = this.parseBool(buffer, block); break;
				case 'SHRB': this.showReflectionOnBall = this.parseBool(buffer, block); break;
				case 'BMSC': this.meshRadius = this.parseFloat(buffer, block); break;
				case 'BMVA': this.modulateVsAdd = this.parseFloat(buffer, block); break;
				case 'BHHI': this.bulbHaloHeight = this.parseFloat(buffer, block); break;
				default:
					this.parseUnknownBlock(buffer, block);
					break;
			}
		}
	}
}
