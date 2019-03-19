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

import { Vector2 as ThreeVector2, Vector3 as ThreeVector3 } from 'three';

export class Vertex2D extends ThreeVector2 {

	public static get(buffer: Buffer) {
		const v2 = new Vertex2D();
		v2.x = buffer.readFloatLE(0);
		v2.y = buffer.readFloatLE(4);
		return v2;
	}

	public static from(data: any): Vertex2D {
		return Object.assign(new Vertex2D(), data);
	}

	public readonly isVector3 = false;

	constructor(x?: number, y?: number) {
		super(x, y);
	}
}

export class RenderVertex extends Vertex2D {
	public fSmooth: boolean;
	public fSlingshot: boolean;
	public fControlPoint: boolean; // Whether this point was a control point on the curve
	public padd: boolean;

	constructor(x?: number, y?: number) {
		super(x, y);
	}
}

export class Vertex3D extends ThreeVector3 {

	public static get(buffer: Buffer) {
		const v3 = new Vertex3D();
		v3.x = buffer.readFloatLE(0);
		v3.y = buffer.readFloatLE(4);
		if (buffer.length >= 12) {
			v3.z = buffer.readFloatLE(8);
		}
		return v3;
	}

	public static from(data: any): Vertex3D {
		return Object.assign(new Vertex3D(), data);
	}

	public static getRotatedAxis(angle: number, axis: Vertex3D, temp: Vertex3D): Vertex3D {
		const u = axis.clone();
		u.normalize();

		const sinAngle = Math.sin((Math.PI / 180.0) * angle);
		const cosAngle = Math.cos((Math.PI / 180.0) * angle);
		const oneMinusCosAngle = 1.0 - cosAngle;

		const rotMatrixRow0 = new Vertex3D();
		const rotMatrixRow1 = new Vertex3D();
		const rotMatrixRow2 = new Vertex3D();

		rotMatrixRow0.x = u.x * u.x + cosAngle * (1.0 - u.x * u.x);
		rotMatrixRow0.y = u.x * u.y * oneMinusCosAngle - sinAngle * u.z;
		rotMatrixRow0.z = u.x * u.z * oneMinusCosAngle + sinAngle * u.y;

		rotMatrixRow1.x = u.x * u.y * oneMinusCosAngle + sinAngle * u.z;
		rotMatrixRow1.y = u.y * u.y + cosAngle * (1.0 - u.y * u.y);
		rotMatrixRow1.z = u.y * u.z * oneMinusCosAngle - sinAngle * u.x;

		rotMatrixRow2.x = u.x * u.z * oneMinusCosAngle - sinAngle * u.y;
		rotMatrixRow2.y = u.y * u.z * oneMinusCosAngle + sinAngle * u.x;
		rotMatrixRow2.z = u.z * u.z + cosAngle * (1.0 - u.z * u.z);

		return new Vertex3D(temp.dot(rotMatrixRow0), temp.dot(rotMatrixRow1), temp.dot(rotMatrixRow2));
	}

	public readonly isVector2 = false;

	constructor(x?: number, y?: number, z?: number) {
		super(x, y, z);
	}

	public xy(): Vertex2D {
		return new Vertex2D(this.x, this.y);
	}
}

export class Vertex3DNoTex2 {

	public static size = 32;

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

	public x: number;
	public y: number;
	public z: number;

	public nx: number;
	public ny: number;
	public nz: number;

	public tu: number;
	public tv: number;
}
