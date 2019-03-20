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
import { GameItem } from './game-item';
import { Vertex2D } from './vertex';

export class FlipperItem extends GameItem {

	public wzName: string;
	public pdata: number;
	public Center: Vertex2D;
	public BaseRadius: number;
	public EndRadius: number;
	public FlipperRadiusMax: number;
	public return: number;
	public StartAngle: number;
	public EndAngle: number;
	public OverridePhysics: number;
	public mass: number;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public szSurface: string;
	public szMaterial: string;
	public szRubberMaterial: string;
	public rubberthickness: number;
	public rubberheight: number;
	public rubberwidth: number;
	public height: number;
	public strength: number;
	public elasticity: number;
	public elasticityFalloff: number;
	public friction: number;
	public rampUp: number;
	public scatter: number;
	public torqueDamping: number;
	public torqueDampingAngle: number;
	public FlipperRadiusMin: number;
	public fVisible: boolean;
	public fEnabled: boolean;
	public fReflectionEnabled: boolean;
	public szImage: string;

	public static async fromStorage(storage: Storage, itemName: string): Promise<FlipperItem> {
		const flipperItem = new FlipperItem();
		await storage.streamFiltered(itemName, 4, FlipperItem.createStreamHandler(flipperItem));
		return flipperItem;
	}

	public static from(data: any): FlipperItem {
		const flipperItem = new FlipperItem();
		Object.assign(flipperItem, data);
		return flipperItem;
	}

	private static createStreamHandler(lightItem: FlipperItem) {
		return BiffParser.stream(lightItem.fromTag.bind(lightItem));
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public serialize() {
		return {
			name: this.wzName,
			center: this.Center,
		};
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.Center = Vertex2D.get(buffer); break;
			case 'BASR': this.BaseRadius = this.getFloat(buffer); break;
			case 'ENDR': this.EndRadius = this.getFloat(buffer); break;
			case 'FLPR': this.FlipperRadiusMax = this.getFloat(buffer); break;
			case 'FRTN': this.return = this.getFloat(buffer); break;
			case 'ANGS': this.StartAngle = this.getFloat(buffer); break;
			case 'ANGE': this.EndAngle = this.getFloat(buffer); break;
			case 'OVRP': this.OverridePhysics = this.getInt(buffer); break;
			case 'FORC': this.mass = this.getFloat(buffer); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'RUMA': this.szRubberMaterial = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'RTHK': this.rubberthickness = this.getInt(buffer); break;
			case 'RTHF': this.rubberthickness = this.getFloat(buffer); break;
			case 'RHGT': this.rubberheight = this.getInt(buffer); break;
			case 'RHGF': this.rubberheight = this.getFloat(buffer); break;
			case 'RWDT': this.rubberwidth = this.getInt(buffer); break;
			case 'RWDF': this.rubberwidth = this.getFloat(buffer); break;
			case 'FHGT': this.height = this.getFloat(buffer); break;
			case 'STRG': this.strength = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'ELFO': this.elasticityFalloff = this.getFloat(buffer); break;
			case 'FRIC': this.friction = this.getFloat(buffer); break;
			case 'RPUP': this.rampUp = this.getFloat(buffer); break;
			case 'SCTR': this.scatter = this.getFloat(buffer); break;
			case 'TODA': this.torqueDamping = this.getFloat(buffer); break;
			case 'TDAA': this.torqueDampingAngle = this.getFloat(buffer); break;
			case 'FRMN': this.FlipperRadiusMin = this.getFloat(buffer); break;
			case 'VSBL': this.fVisible = this.getBool(buffer); break;
			case 'ENBL': this.fEnabled = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
