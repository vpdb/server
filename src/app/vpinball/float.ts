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

/**
 * Converts a 64-bit floating point number (Node.js) to a 32-bit
 * float used in C.
 *
 * @param float8
 */
export function f4(float8: number): number {
	if (float8 === 0) {
		return 0;
	}
	const exp = Math.floor(Math.log10(Math.abs(float8)));
	const f = Math.pow(10, 8 - exp);
	return Math.round(Math.fround(float8) * f) / f;
}
