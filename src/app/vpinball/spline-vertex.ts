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

import { DragPoint } from './dragpoint';
import { RenderVertex, Vertex2D } from './vertex';

export class SplineVertex {

	/** number of vertices for the central curve */
	public pcvertex: number;

	/** true if i-th vertex corresponds to a control point */
	public ppfCross: boolean[] = [];

	/** vertices forming the 2D outline of the ramp */
	public pMiddlePoints: Vertex2D[] = [];

	public rgvLocal: Vertex2D[] = [];

	public static getInstance(dragPoints: DragPoint[], thickness: number, tableDetailLevel: number, accuracy: number, staticRendering = true): SplineVertex {

		const v = new SplineVertex();
		const vvertex = SplineVertex.getCentralCurve(dragPoints, tableDetailLevel, accuracy, staticRendering);

		const cvertex = vvertex.length;

		for (let i = 0; i < cvertex; i++) {
			// prev and next wrap around as rubbers always loop
			const vprev = vvertex[(i > 0) ? i - 1 : cvertex - 1];
			const vnext = vvertex[(i < (cvertex - 1)) ? i + 1 : 0];
			const vmiddle = vvertex[i];

			v.ppfCross[i] = vmiddle.fControlPoint;

			let vnormal: Vertex2D;

			// Get normal at this point
			// Notice that these values equal the ones in the line
			// equation and could probably be substituted by them.
			const v1normal = new Vertex2D(vprev.y - vmiddle.y, vmiddle.x - vprev.x);   // vector vmiddle-vprev rotated RIGHT
			const v2normal = new Vertex2D(vmiddle.y - vnext.y, vnext.x - vmiddle.x);   // vector vnext-vmiddle rotated RIGHT

			// not needed special start/end handling as rubbers always loop, except for the case where there are only 2 control points
			if (cvertex === 2 && i === (cvertex - 1)) {
				v1normal.normalize();
				vnormal = v1normal;

			} else if (cvertex === 2 && i === 0) {
				v2normal.normalize();
				vnormal = v2normal;

			} else {
				v1normal.normalize();
				v2normal.normalize();

				if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
					// Two parallel segments
					vnormal = v1normal;

				} else {
					// Find intersection of the two edges meeting this points, but
					// shift those lines outwards along their normals

					// First line
					const A = vprev.y - vmiddle.y;
					const B = vmiddle.x - vprev.x;

					// Shift line along the normal
					const C = A * (v1normal.x - vprev.x) + B * (v1normal.y - vprev.y);

					// Second line
					const D = vnext.y - vmiddle.y;
					const E = vmiddle.x - vnext.x;

					// Shift line along the normal
					const F = D * (v2normal.x - vnext.x) + E * (v2normal.y - vnext.y);

					const det = A * E - B * D;
					const invDet = (det !== 0.0) ? 1.0 / det : 0.0;

					const intersectx = (B * F - E * C) * invDet;
					const intersecty = (C * D - A * F) * invDet;

					vnormal = new Vertex2D(vmiddle.x - intersectx, vmiddle.y - intersecty);
				}
			}

			const widthcur = thickness;

			v.pMiddlePoints[i] = vmiddle;

			// vmiddle + (widthcur * 0.5) * vnormal;
			v.rgvLocal[i] = vmiddle.clone().add(vnormal.clone().multiplyScalar(widthcur * 0.5));

			//vmiddle - (widthcur*0.5f) * vnormal;
			v.rgvLocal[(cvertex + 1) * 2 - i - 1] = vmiddle.clone().sub(vnormal.clone().multiplyScalar(widthcur * 0.5));

			if (i === 0) {
				v.rgvLocal[cvertex] = v.rgvLocal[0];
				v.rgvLocal[(cvertex + 1) * 2 - cvertex - 1] = v.rgvLocal[(cvertex + 1) * 2 - 1];
			}
		}

		v.ppfCross[cvertex] = vvertex[0].fControlPoint;
		v.pMiddlePoints[cvertex] = v.pMiddlePoints[0];
		v.pcvertex = cvertex + 1;

		return v;
	}

	private static getCentralCurve(dragPoints: DragPoint[], tableDetailLevel: number, acc: number, staticRendering = true): RenderVertex[] {

		let accuracy: number;

		// as solid rubbers are rendered into the static buffer, always use maximum precision
		if (acc !== -1.0) {
			accuracy = acc; // used for hit shape calculation, always!
		} else {
			if (staticRendering) {
				accuracy = 10.0;
			} else {
				accuracy = tableDetailLevel;
			}
			accuracy = 4.0 * Math.pow(10.0, (10.0 - accuracy) * (1.0 / 1.5)); // min = 4 (highest accuracy/detail level), max = 4 * 10^(10/1.5) = ~18.000.000 (lowest accuracy/detail level)
		}
		return DragPoint.getRgVertex<RenderVertex>(dragPoints, () => new RenderVertex(), true, accuracy);
	}
}
