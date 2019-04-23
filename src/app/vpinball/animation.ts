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

export class FrameData {

	public frameVerts: VertData[] = [];

	public static get(buffer: Buffer, numVertices: number): FrameData {
		const frameData = new FrameData();
		for (let i = 0; i < numVertices; i++) {
			frameData.frameVerts.push(VertData.load(buffer, i * 24));
		}
		return frameData;
	}

	public static from(data: any): FrameData {
		const frameData = new FrameData();
		for (const frameVert of data.frameVerts) {
			frameData.frameVerts.push(VertData.from(frameVert));
		}
		return frameData;
	}

	public clone(): FrameData {
		const frameData = new FrameData();
		frameData.frameVerts = this.frameVerts.map(v => v.clone());
		return frameData;
	}

}

export class VertData {

	public x: number;
	public y: number;
	public z: number;

	public nx: number;
	public ny: number;
	public nz: number;

	public static load(buffer: Buffer, offset: number = 0): VertData {
		const vertData = new VertData();
		vertData.x = buffer.readFloatLE(offset);
		vertData.y = buffer.readFloatLE(offset + 4);
		vertData.z = buffer.readFloatLE(offset + 8);
		vertData.nx = buffer.readFloatLE(offset + 12);
		vertData.ny = buffer.readFloatLE(offset + 16);
		vertData.nz = buffer.readFloatLE(offset + 20);
		return vertData;
	}

	public static from(data: any): VertData {
		return Object.assign(new VertData(), data);
	}

	public clone(): VertData {
		const vertData = new VertData();
		vertData.x = this.x;
		vertData.y = this.y;
		vertData.z = this.z;
		vertData.nx = this.nx;
		vertData.ny = this.ny;
		vertData.nz = this.nz;
		return vertData;
	}
}
