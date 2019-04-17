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

/* tslint:disable:variable-name adjacent-overload-signatures */
import { isUndefined } from 'util';
import { Vertex2D } from './vertex2d';
import { Vertex3D } from './vertex3d';

export interface IRenderVertex {
	x: number;
	y: number;
	fSmooth: boolean;
	fSlingshot: boolean;
	fControlPoint: boolean;
	isVector3: boolean;

	set?(x: number, y: number, z?: number): this;
}

export class RenderVertex extends Vertex2D implements IRenderVertex {
	public fSmooth: boolean;
	public fSlingshot: boolean;
	public fControlPoint: boolean; // Whether this point was a control point on the curve

	constructor(x?: number, y?: number) {
		super(x, y);
	}
}

export class RenderVertex3D extends Vertex3D implements IRenderVertex {
	public fSmooth: boolean;
	public fSlingshot: boolean;
	public fControlPoint: boolean; // Whether this point was a control point on the curve

	constructor(x?: number, y?: number, z?: number) {
		super(x, y, z);
	}
}

export class Vertex3DNoTex2 {

	public static size = 32;

	public x: number = 0;
	public y: number = 0;
	public z: number = 0;

	public nx: number = 0;
	public ny: number = 0;
	public nz: number = 0;

	public tu: number = 0;
	public tv: number = 0;

	public static get(buffer: Buffer, pos: number): Vertex3DNoTex2 {
		const offset = pos * Vertex3DNoTex2.size;
		const vertex = new Vertex3DNoTex2();
		vertex.x = buffer.readFloatLE(offset);
		vertex.y = buffer.readFloatLE(offset + 4);
		vertex.z = buffer.readFloatLE(offset + 8);
		vertex.nx = buffer.readFloatLE(offset + 12);
		vertex.ny = buffer.readFloatLE(offset + 16);
		vertex.nz = buffer.readFloatLE(offset + 20);
		vertex.tu = buffer.readFloatLE(offset + 24);
		vertex.tv = buffer.readFloatLE(offset + 28);
		return vertex;
	}

	public clone(): Vertex3DNoTex2 {
		const vertex = new Vertex3DNoTex2();
		vertex.x = this.x;
		vertex.y = this.y;
		vertex.z = this.z;
		vertex.nx = this.nx;
		vertex.ny = this.ny;
		vertex.nz = this.nz;
		vertex.tu = this.tu;
		vertex.tv = this.tv;
		return vertex;
	}

	public hasTextureCoordinates(): boolean {
		return !isUndefined(this.tu) && !isUndefined(this.tv);
	}

	public static from(data: any): Vertex3DNoTex2 {
		return Object.assign(new Vertex3DNoTex2(), data);
	}

	public static fromArray(arr: number[]): Vertex3DNoTex2 {
		const vertex = new Vertex3DNoTex2();
		vertex.x = arr[0];
		vertex.y = arr[1];
		vertex.z = arr[2];
		vertex.nx = arr[3];
		vertex.ny = arr[4];
		vertex.nz = arr[5];
		vertex.tu = arr[6];
		vertex.tv = arr[7];
		return vertex;
	}
}
