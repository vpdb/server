import { Vertex3D } from './vertex';

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
		const inv_wp = 1.0 / wp;
		return new Vertex3D(xp * inv_wp, yp * inv_wp, zp * inv_wp);
	}

	public multiplyVectorNoTranslate(v: Vertex3D): Vertex3D {
		// Transform it through the current matrix set
		const xp = this._11 * v.x + this._21 * v.y + this._31 * v.z;
		const yp = this._12 * v.x + this._22 * v.y + this._32 * v.z;
		const zp = this._13 * v.x + this._23 * v.y + this._33 * v.z;
		return new Vertex3D(xp, yp, zp);
	}

	public multiply(mult: Matrix3D): void {
		const matrixT = new Matrix3D;
		for (let i = 0; i < 4; ++i) {
			for (let l = 0; l < 4; ++l) {
				matrixT.matrix[i][l] =
					(this.matrix[0][l] * mult.matrix[i][0]) +
					(this.matrix[1][l] * mult.matrix[i][1]) +
					(this.matrix[2][l] * mult.matrix[i][2]) +
					(this.matrix[3][l] * mult.matrix[i][3]);
			}
		}
		Object.assign(this.matrix, matrixT.matrix);
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
	get _12() { return this.matrix[1][0]; }
	get _13() { return this.matrix[2][0]; }
	get _14() { return this.matrix[3][0]; }
	get _21() { return this.matrix[0][1]; }
	get _22() { return this.matrix[1][1]; }
	get _23() { return this.matrix[2][1]; }
	get _24() { return this.matrix[3][1]; }
	get _31() { return this.matrix[0][2]; }
	get _32() { return this.matrix[1][2]; }
	get _33() { return this.matrix[2][2]; }
	get _34() { return this.matrix[3][2]; }
	get _41() { return this.matrix[0][3]; }
	get _42() { return this.matrix[1][3]; }
	get _43() { return this.matrix[2][3]; }
	get _44() { return this.matrix[3][3]; }

	set _11(v) { this.matrix[0][0] = v; }
	set _12(v) { this.matrix[1][0] = v; }
	set _13(v) { this.matrix[2][0] = v; }
	set _14(v) { this.matrix[3][0] = v; }
	set _21(v) { this.matrix[0][1] = v; }
	set _22(v) { this.matrix[1][1] = v; }
	set _23(v) { this.matrix[2][1] = v; }
	set _24(v) { this.matrix[3][1] = v; }
	set _31(v) { this.matrix[0][2] = v; }
	set _32(v) { this.matrix[1][2] = v; }
	set _33(v) { this.matrix[2][2] = v; }
	set _34(v) { this.matrix[3][2] = v; }
	set _41(v) { this.matrix[0][3] = v; }
	set _42(v) { this.matrix[1][3] = v; }
	set _43(v) { this.matrix[2][3] = v; }
	set _44(v) { this.matrix[3][3] = v; }
}