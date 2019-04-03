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

import { Vertex3D } from './vertex';

/**
 * Three's Matrix4.multiply() gives different results than VPinball's. Duh.
 * Here's an implementation that does the same thing.
 *
 * @see https://github.com/vpinball/vpinball/blob/master/math/matrix.h#L160
 */
export class Matrix3D {

	private readonly matrix = [
		[ 1, 0, 0, 0 ],
		[ 0, 1, 0, 0 ],
		[ 0, 0, 1, 0 ],
		[ 0, 0, 0, 1 ],
	];

	constructor() {
		this.setIdentity();
	}

	public setIdentity() {
		this._11 = this._22 = this._33 = this._44 = 1.0;
		this._12 = this._13 = this._14 = this._41 =
		this._21 = this._23 = this._24 = this._42 =
		this._31 = this._32 = this._34 = this._43 = 0.0;
	}

	public setTranslation(tx: number, ty: number, tz: number) {
		this.setIdentity();
		this._41 = tx;
		this._42 = ty;
		this._43 = tz;
	}

	public setScaling(sx: number, sy: number, sz: number) {
		this.setIdentity();
		this._11 = sx;
		this._22 = sy;
		this._33 = sz;
	}

	public rotateXMatrix(x: number) {
		this.setIdentity();
		this._22 = this._33 = Math.cos(x);
		this._23 = Math.sin(x);
		this._32 = -this._23;
	}

	public rotateYMatrix(y: number) {
		this.setIdentity();
		this._11 = this._33 = Math.cos(y);
		this._31 = Math.sin(y);
		this._13 = -this._31;
	}

	public rotateZMatrix(z: number) {
		this.setIdentity();
		this._11 = this._22 = Math.cos(z);
		this._12 = Math.sin(z);
		this._21 = -this._12;
	}

	public scale(x: number, y: number, z: number) {
		this._11 *= x;
		this._12 *= x;
		this._13 *= x;
		this._21 *= y;
		this._22 *= y;
		this._23 *= y;
		this._31 *= z;
		this._32 *= z;
		this._33 *= z;
	}

	public multiplyVector(v: Vertex3D): Vertex3D {
		// Transform it through the current matrix set
		const xp: number = this._11 * v.x + this._21 * v.y + this._31 * v.z + this._41;
		const yp = this._12 * v.x + this._22 * v.y + this._32 * v.z + this._42;
		const zp = this._13 * v.x + this._23 * v.y + this._33 * v.z + this._43;
		const wp = this._14 * v.x + this._24 * v.y + this._34 * v.z + this._44;
		const invWp = 1.0 / wp;
		return new Vertex3D(xp * invWp, yp * invWp, zp * invWp);
	}

	public multiplyVectorNoTranslate(v: Vertex3D): Vertex3D {
		// Transform it through the current matrix set
		const xp = this._11 * v.x + this._21 * v.y + this._31 * v.z;
		const yp = this._12 * v.x + this._22 * v.y + this._32 * v.z;
		const zp = this._13 * v.x + this._23 * v.y + this._33 * v.z;
		return new Vertex3D(xp, yp, zp);
	}

	public multiply(a: Matrix3D, b?: Matrix3D): this {
		if (b) {
			Object.assign(this.matrix, Matrix3D.multiplyMatrices(a, b).matrix);
		} else {
			Object.assign(this.matrix, Matrix3D.multiplyMatrices(this, a).matrix);
		}
		return this;
	}

	public preMultiply(a: Matrix3D): this {
		Object.assign(this.matrix, Matrix3D.multiplyMatrices(a, this).matrix);
		return this;
	}

	public toRightHanded(): Matrix3D {
		const tempMat = new Matrix3D();
		tempMat.setScaling(1, 1, -1);
		return this.clone().multiply(tempMat);
	}

	private static multiplyMatrices(a: Matrix3D, b: Matrix3D): Matrix3D {
		const result = new Matrix3D();
		for (let i = 0; i < 4; ++i) {
			for (let l = 0; l < 4; ++l) {
				result.matrix[i][l] =
					(a.matrix[0][l] * b.matrix[i][0]) +
					(a.matrix[1][l] * b.matrix[i][1]) +
					(a.matrix[2][l] * b.matrix[i][2]) +
					(a.matrix[3][l] * b.matrix[i][3]);
			}
		}
		return result;
	}

	public clone(): Matrix3D {
		const matrix = new Matrix3D();
		Object.assign(matrix.matrix, this.matrix);
		return matrix;
	}

	public debug(): string[] {
		return [
			`_11: ${this._11}`,
			`_12: ${this._12}`,
			`_13: ${this._13}`,
			`_14: ${this._14}`,
			`_21: ${this._21}`,
			`_22: ${this._22}`,
			`_23: ${this._23}`,
			`_24: ${this._24}`,
			`_31: ${this._31}`,
			`_32: ${this._32}`,
			`_33: ${this._33}`,
			`_34: ${this._34}`,
			`_41: ${this._41}`,
			`_42: ${this._42}`,
			`_43: ${this._43}`,
			`_44: ${this._44}`,
		];
	}

	get _11() { return this.matrix[0][0]; }
	set _11(v) { this.matrix[0][0] = v; }
	get _12() { return this.matrix[1][0]; }
	set _12(v) { this.matrix[1][0] = v; }
	get _13() { return this.matrix[2][0]; }
	set _13(v) { this.matrix[2][0] = v; }
	get _14() { return this.matrix[3][0]; }
	set _14(v) { this.matrix[3][0] = v; }
	get _21() { return this.matrix[0][1]; }
	set _21(v) { this.matrix[0][1] = v; }
	get _22() { return this.matrix[1][1]; }
	set _22(v) { this.matrix[1][1] = v; }
	get _23() { return this.matrix[2][1]; }
	set _23(v) { this.matrix[2][1] = v; }
	get _24() { return this.matrix[3][1]; }
	set _24(v) { this.matrix[3][1] = v; }
	get _31() { return this.matrix[0][2]; }
	set _31(v) { this.matrix[0][2] = v; }
	get _32() { return this.matrix[1][2]; }
	set _32(v) { this.matrix[1][2] = v; }
	get _33() { return this.matrix[2][2]; }
	set _33(v) { this.matrix[2][2] = v; }
	get _34() { return this.matrix[3][2]; }
	set _34(v) { this.matrix[3][2] = v; }
	get _41() { return this.matrix[0][3]; }
	set _41(v) { this.matrix[0][3] = v; }
	get _42() { return this.matrix[1][3]; }
	set _42(v) { this.matrix[1][3] = v; }
	get _43() { return this.matrix[2][3]; }
	set _43(v) { this.matrix[2][3] = v; }
	get _44() { return this.matrix[3][3]; }
	set _44(v) { this.matrix[3][3] = v; }
}
