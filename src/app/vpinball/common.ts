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

import { BiffBlock } from './biff-parser';

export class Mesh {

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

	private static exportPrecision = 6;

	public vertices: Vertex3DNoTex2[] = [];
	public animationFrames: FrameData[] = [];
	public indices: number[] = [];
	private faceIndexOffset = 0;

	public serializeToObj(description: string): string {

		const objFile: string[] = [];
		//const mtlFile: string[] = [];

		//this._writeHeader(objFile, mtlFile, basename(fileName) + '.wt');
		this._writeObjectName(objFile, description);
		this._writeVertexInfo(objFile);
		this._writeFaceInfoLong(objFile);

		return objFile.join('\n');
	}

	private _writeHeader(objFile: string[], mtlFile: string[], mtlFilename: string): void {
		mtlFile.push(`# Visual Pinball table mat file`);

		objFile.push(`# Visual Pinball table OBJ file`);
		objFile.push(`mtllib ${mtlFilename}`);
		objFile.push(`# numVerts: ${this.vertices.length} numFaces: ${this.indices.length}`);
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

export class Vector3 {

	public static get(buffer: Buffer) {
		const v3 = new Vector3();
		v3.x = buffer.readFloatLE(0);
		v3.y = buffer.readFloatLE(4);
		v3.z = buffer.readFloatLE(8);
		return v3;
	}

	public static from(data: any): Vector3 {
		return Object.assign(new Vector3(), data);
	}

	public x: number;
	public y: number;
	public z: number;
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

export class FrameData {

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

	public frameVerts: VertData[] = [];
}

export class VertData {

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

	public x: number;
	public y: number;
	public z: number;

	public nx: number;
	public ny: number;
	public nz: number;
}

export class Vertex2D {

	public static load(buffer: Buffer, block: BiffBlock) {
		const v2 = new Vertex2D();
		v2.x = buffer.readFloatLE(block.pos);
		v2.y = buffer.readFloatLE(block.pos + 4);
		return v2;
	}

	public static get(buffer: Buffer) {
		const v2 = new Vertex2D();
		v2.x = buffer.readFloatLE(0);
		v2.y = buffer.readFloatLE(4);
		return v2;
	}

	public static from(data: any): Vertex2D {
		return Object.assign(new Vertex2D(), data);
	}

	public x: number;
	public y: number;
}

export class Vertex3D {

	public static load(buffer: Buffer, block: BiffBlock) {
		const v3 = new Vertex3D();
		v3.x = buffer.readFloatLE(block.pos);
		v3.y = buffer.readFloatLE(block.pos + 4);
		v3.z = buffer.readFloatLE(block.pos + 8);
		return v3;
	}

	public static from(data: any): Vertex3D {
		return Object.assign(new Vertex3D(), data);
	}

	public x: number;
	public y: number;
	public z: number;
}
