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

import { FrameData } from './common';
import { RenderVertex, Vertex2D, Vertex3D, Vertex3DNoTex2 } from './vertex';

export const FLT_MIN = 1.175494350822287507968736537222245677819e-038;
export const FLT_MAX = 340282346638528859811704183484516925440;

export class Mesh {

	private static exportPrecision = 6;

	public name: string;
	public vertices: Vertex3DNoTex2[] = [];
	public animationFrames: FrameData[] = [];
	public indices: number[] = [];
	public faceIndexOffset = 0;

	public static from(data: any): Mesh {
		const mesh = new Mesh();
		for (const vertex of data.vertices) {
			mesh.vertices.push(Vertex3DNoTex2.from(vertex));
		}
		for (const animationFrame of data.animationFrames) {
			mesh.animationFrames.push(FrameData.from(animationFrame));
		}
		mesh.indices = data.indices;
		return mesh;
	}

	public static fromArray(vertices: number[][], indices: number[]): Mesh {
		const mesh = new Mesh();
		for (const vertex of vertices) {
			mesh.vertices.push(Vertex3DNoTex2.fromArray(vertex));
		}
		mesh.indices = indices;
		return mesh;
	}

	public serializeToObj(description?: string): string {

		const objFile: string[] = [];
		//const mtlFile: string[] = [];

		//this._writeHeader(objFile, mtlFile, basename(fileName) + '.wt');
		this._writeObjectName(objFile, description || this.name);
		this._writeVertexInfo(objFile);
		this._writeFaceInfoLong(objFile);

		return objFile.join('\n');
	}

	public clone(): Mesh {
		const mesh = new Mesh();
		mesh.name = this.name;
		mesh.vertices = this.vertices.map(v => v.clone());
		mesh.animationFrames = this.animationFrames.map(a => a.clone());
		mesh.indices = this.indices.slice();
		mesh.faceIndexOffset = this.faceIndexOffset;
		return mesh;
	}

	public static computeNormals(vertices: Vertex3DNoTex2[], numVertices: number, indices: number[], numIndices: number) {

		for (let i = 0; i < numVertices; i++) {
			const v = vertices[i];
			v.nx = v.ny = v.nz = 0.0;
		}

		for (let i = 0; i < numIndices; i += 3) {
			const A = vertices[indices[i]];
			const B = vertices[indices[i + 1]];
			const C = vertices[indices[i + 2]];

			const e0 = new Vertex3D(B.x - A.x, B.y - A.y, B.z - A.z);
			const e1 = new Vertex3D(C.x - A.x, C.y - A.y, C.z - A.z);
			const normal = e0.clone().cross(e1);
			normal.normalize();

			A.nx += normal.x; A.ny += normal.y; A.nz += normal.z;
			B.nx += normal.x; B.ny += normal.y; B.nz += normal.z;
			C.nx += normal.x; C.ny += normal.y; C.nz += normal.z;
		}

		for (let i = 0; i < numVertices; i++) {
			const v = vertices[i];
			const l = v.nx * v.nx + v.ny * v.ny + v.nz * v.nz;
			const invL = (l >= FLT_MIN) ? 1.0 / Math.sqrt(l) : 0.0;
			v.nx *= invL;
			v.ny *= invL;
			v.nz *= invL;
		}
	}

	public static polygonToTriangles(rgv: RenderVertex[], pvpoly: number[]): number[] {
		const pvtri: number[] = [];
		// There should be this many convex triangles.
		// If not, the polygon is self-intersecting
		const tricount = pvpoly.length - 2;

		for (let l = 0; l < tricount; ++l) {
			for (let i = 0; i < pvpoly.length; ++i) {
				const s = pvpoly.length;
				const pre = pvpoly[(i == 0) ? (s - 1) : (i - 1)];
				const a = pvpoly[i];
				const b = pvpoly[(i < s - 1) ? (i + 1) : 0];
				const c = pvpoly[(i < s - 2) ? (i + 2) : ((i + 2) - s)];
				const post = pvpoly[(i < s - 3) ? (i + 3) : ((i + 3) - s)];
				if (Mesh.advancePoint(rgv, pvpoly, a, b, c, pre, post)) {
					pvtri.push(a);
					pvtri.push(c);
					pvtri.push(b);
					pvpoly.splice((i < s - 1) ? (i + 1) : 0, 1); // b
					break;
				}
			}
		}
		return pvtri;
	}

	private static advancePoint(rgv: RenderVertex[], pvpoly: number[], a: number, b: number, c: number, pre: number, post: number): boolean {
		const pv1 = rgv[a];
		const pv2 = rgv[b];
		const pv3 = rgv[c];

		const pvPre = rgv[pre];
		const pvPost = rgv[post];

		if ((Mesh.getDot(pv1, pv2, pv3) < 0) ||
		// Make sure angle created by new triangle line falls inside existing angles
		// If the existing angle is a concave angle, then new angle must be smaller,
		// because our triangle can't have angles greater than 180
			((Mesh.getDot(pvPre, pv1, pv2) > 0) && (Mesh.getDot(pvPre, pv1, pv3) < 0)) || // convex angle, make sure new angle is smaller than it
			((Mesh.getDot(pv2, pv3, pvPost) > 0) && (Mesh.getDot(pv1, pv3, pvPost) < 0))) {

			return false;
		}

		// Now make sure the interior segment of this triangle (line ac) does not
		// intersect the polygon anywhere

		// sort our static line segment
		const minx = Math.min(pv1.x, pv3.x);
		const maxx = Math.max(pv1.x, pv3.x);
		const miny = Math.min(pv1.y, pv3.y);
		const maxy = Math.max(pv1.y, pv3.y);

		for (let i = 0; i < pvpoly.length; ++i) {

		const pvCross1 = rgv[pvpoly[i]];
		const pvCross2 = rgv[pvpoly[(i < pvpoly.length - 1) ? (i + 1) : 0]];

		if (pvCross1 != pv1 && pvCross2 != pv1 && pvCross1 != pv3 && pvCross2 != pv3 &&
			(pvCross1.y >= miny || pvCross2.y >= miny) &&
			(pvCross1.y <= maxy || pvCross2.y <= maxy) &&
			(pvCross1.x >= minx || pvCross2.x >= minx) &&
			(pvCross1.x <= maxx || pvCross2.y <= maxx) &&
			Mesh.fLinesIntersect(pv1, pv3, pvCross1, pvCross2)) {
			return false;
		}
	}

	return true;
	}

	private static getDot(pvEnd1: Vertex2D, pvJoint: Vertex2D, pvEnd2: Vertex2D): number {
		return (pvJoint.x - pvEnd1.x) * (pvJoint.y - pvEnd2.y)
			- (pvJoint.y - pvEnd1.y) * (pvJoint.x - pvEnd2.x);
	}

	private static fLinesIntersect(Start1: Vertex2D, Start2: Vertex2D, End1: Vertex2D, End2: Vertex2D): boolean {

		const x1 = Start1.x;
		const y1 = Start1.y;
		const x2 = Start2.x;
		const y2 = Start2.y;
		const x3 = End1.x;
		const y3 = End1.y;
		const x4 = End2.x;
		const y4 = End2.y;

		const d123 = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);

		if (d123 == 0.0) { // p3 lies on the same line as p1 and p2
			return (x3 >= Math.min(x1, x2) && x3 <= Math.max(x2, x1));
		}

		const d124 = (x2 - x1) * (y4 - y1) - (x4 - x1) * (y2 - y1);

		if (d124 == 0.0) { // p4 lies on the same line as p1 and p2
			return (x4 >= Math.min(x1, x2) && x4 <= Math.max(x2, x1));
		}

		if (d123 * d124 >= 0.0) {
			return false;
		}

		const d341 = (x3 - x1) * (y4 - y1) - (x4 - x1) * (y3 - y1);

		if (d341 == 0.0) { // p1 lies on the same line as p3 and p4
			return (x1 >= Math.min(x3, x4) && x1 <= Math.max(x3, x4));
		}

		const d342 = d123 - d124 + d341;

		if (d342 === 0.0) { // p1 lies on the same line as p3 and p4
			return (x2 >= Math.min(x3, x4) && x2 <= Math.max(x3, x4));
		}

		return (d341 * d342 < 0.0);
	}

	private _writeObjectName(objFile: string[], objName: string): void {
		objFile.push(`o ${objName}`);
	}

	private _writeVertexInfo(objFile: string[]): void {
		for (const vert of this.vertices) {
			objFile.push(`v ${vert.x.toFixed(Mesh.exportPrecision)} ${vert.y.toFixed(Mesh.exportPrecision)} ${(-vert.z).toFixed(Mesh.exportPrecision)}`);
		}
		for (const vert of this.vertices) {
			let tu = vert.tu;
			let tv = 1 - vert.tv;
			if (tu !== tu) {
				tu = 0.0;
			}
			if (tv !== tv) {
				tv = 0.0;
			}
			objFile.push(`vt ${tu.toFixed(Mesh.exportPrecision)} ${tv.toFixed(Mesh.exportPrecision)}`);
		}
		for (const vert of this.vertices) {
			let nx = vert.nx;
			let ny = vert.ny;
			let nz = vert.nz;
			if (nx !== nx) {
				nx = 0.0;
			}
			if (ny !== ny) {
				ny = 0.0;
			}
			if (nz !== nz) {
				nz = 0.0;
			}
			objFile.push(`vn ${nx.toFixed(Mesh.exportPrecision)} ${ny.toFixed(Mesh.exportPrecision)} ${(-nz).toFixed(Mesh.exportPrecision)}`);
		}
	}

	private _writeFaceInfoLong(objFile: string[]): void {
		const faces = this.indices;
		for (let i = 0; i < this.indices.length; i += 3) {
			const values = [
				[faces[i + 2] + 1 + this.faceIndexOffset, faces[i + 2] + 1 + this.faceIndexOffset, faces[i + 2] + 1 + this.faceIndexOffset],
				[faces[i + 1] + 1 + this.faceIndexOffset, faces[i + 1] + 1 + this.faceIndexOffset, faces[i + 1] + 1 + this.faceIndexOffset],
				[faces[i] + 1 + this.faceIndexOffset, faces[i] + 1 + this.faceIndexOffset, faces[i] + 1 + this.faceIndexOffset],
			];
			objFile.push(`f ` + values.map(v => v.join('/')).join(' '));
		}
	}
}
