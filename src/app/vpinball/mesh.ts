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
import { Vertex3D, Vertex3DNoTex2 } from './vertex';

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
