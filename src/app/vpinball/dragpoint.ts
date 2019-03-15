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

import { Vertex3D } from './common';
import { GameItem } from './game-item';

export class DragPoint extends GameItem {

	public static from(data: any): DragPoint {
		const dragPoint = new DragPoint();
		Object.assign(dragPoint, data);
		return dragPoint;
	}

	public vertex: Vertex3D;
	public fSmooth: number;
	public fSlingshot: boolean;
	public fAutoTexture: boolean;
	public texturecoord: number;

	public async fromTag(buffer: Buffer, tag: string): Promise<void> {
		switch (tag) {
			case 'VCEN': this.vertex = Vertex3D.get(buffer); break;
			case 'POSZ': this.vertex.z = this.getFloat(buffer); break;
			case 'SMTH': this.fSmooth = this.getFloat(buffer); break;
			case 'SLNG': this.fSlingshot = this.getBool(buffer); break;
			case 'ATEX': this.fAutoTexture = this.getBool(buffer); break;
			case 'TEXC': this.texturecoord = this.getFloat(buffer); break;
			default: this.getUnknownBlock(buffer, tag); break;
		}
	}

	public getName(): string {
		return null;
	}
}
