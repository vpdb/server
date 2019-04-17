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
import { f4 } from './float';

export class Vertex2D {

	public readonly isVector2 = true;
	public readonly isVector3 = false;

	set x(_x: number) { this._x = f4(_x); }
	set y(_y: number) { this._y = f4(_y); }

	get x() { return this._x; }
	get y() { return this._y; }

	private _x: number;
	private _y: number;

	public static get(buffer: Buffer) {
		const v2 = new Vertex2D();
		v2.x = buffer.readFloatLE(0);
		v2.y = buffer.readFloatLE(4);
		return v2;
	}

	constructor(x?: number, y?: number) {
		this.x = x || 0;
		this.y = y || 0;
	}

	public set(x: number, y: number): this {
		this.x = x;
		this.y = y;
		return this;
	}

	public clone(): Vertex2D {
		return new Vertex2D(this._x, this._y);
	}

	public add(v: Vertex2D): this {
		this.x += v.x;
		this.y += v.y;
		return this;
	}

	public sub(v: Vertex2D): this {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	}

	public normalize(): this {
		return this.divideScalar(this.length() || 1 );
	}

	public divideScalar(scalar: number): this {
		return this.multiplyScalar(f4(1 / scalar));
	}

	public multiplyScalar(scalar: number): this {
		this.x *= scalar;
		this.y *= scalar;
		return this;
	}

	public length() {
		return f4(Math.sqrt( f4(f4(this.x * this.x) + f4(this.y * this.y))));
	}
}
