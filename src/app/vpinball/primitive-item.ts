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

import { basename } from 'path';
import { logger } from '../common/logger';
import { FileUtil } from '../files/file.util';
import { BiffBlock, BiffParser } from './biff-parser';
import { GameItem } from './game-item';

export class PrimitiveItem extends GameItem {

	public static async load(buffer: Buffer): Promise<PrimitiveItem> {
		const primitiveItem = new PrimitiveItem();
		await primitiveItem._load(buffer);
		return primitiveItem;
	}

	public data: PrimitiveData;
	public mesh: Mesh;

	public numVertices: number;
	public compressedAnimationVertices: number;
	public compressedVertices: number;
	public pdata: number;
	public wzName: string;
	public numIndices: number;
	public compressedIndices: number;

	private constructor() {
		super();
		this.mesh = new Mesh();
		this.data = new PrimitiveData();
	}

	public getName() {
		return this.wzName;
	}

	public async exportMeshToObj(fileName: string) {
		await this.mesh.exportToObj(fileName, this.data.use3DMesh ? this.wzName : 'Primitive');
	}

	private async _load(buffer: Buffer) {
		const blocks = BiffParser.parseBiff(buffer, 4);
		for (const block of blocks) {
			switch (block.tag) {
				case 'PIID': this.pdata = this.parseInt(block); break;
				case 'VPOS': this.data.vPosition = new Vector3(block); break;
				case 'VSIZ': this.data.vSize = new Vector3(block); break;
				case 'RTV0': this.data.aRotAndTra[0] = this.parseFloat(block); break;
				case 'RTV1': this.data.aRotAndTra[1] = this.parseFloat(block); break;
				case 'RTV2': this.data.aRotAndTra[2] = this.parseFloat(block); break;
				case 'RTV3': this.data.aRotAndTra[3] = this.parseFloat(block); break;
				case 'RTV4': this.data.aRotAndTra[4] = this.parseFloat(block); break;
				case 'RTV5': this.data.aRotAndTra[5] = this.parseFloat(block); break;
				case 'RTV6': this.data.aRotAndTra[6] = this.parseFloat(block); break;
				case 'RTV7': this.data.aRotAndTra[7] = this.parseFloat(block); break;
				case 'RTV8': this.data.aRotAndTra[8] = this.parseFloat(block); break;
				case 'IMAG': this.data.szImage = this.parseString(block, 4); break;
				case 'NRMA': this.data.szNormalMap = this.parseString(block, 4); break;
				case 'SIDS': this.data.Sides = this.parseInt(block); break;
				case 'NAME': this.wzName = this.parseWideString(block); break;
				case 'MATR': this.data.szMaterial = this.parseString(block, 4); break;
				case 'SCOL': this.data.SideColor = this.parseString(block, 4); break;
				case 'TVIS': this.data.fVisible = this.parseBool(block); break;
				case 'REEN': this.data.fReflectionEnabled = this.parseBool(block); break;
				case 'DTXI': this.data.DrawTexturesInside = this.parseBool(block); break;
				case 'HTEV': this.data.fHitEvent = this.parseBool(block); break;
				case 'THRS': this.data.threshold = this.parseFloat(block); break;
				case 'ELAS': this.data.elasticity = this.parseFloat(block); break;
				case 'ELFO': this.data.elasticityFalloff = this.parseFloat(block); break;
				case 'RFCT': this.data.friction = this.parseFloat(block); break;
				case 'RSCT': this.data.scatter = this.parseFloat(block); break;
				case 'EFUI': this.data.edgeFactorUI = this.parseFloat(block); break;
				case 'CORF': this.data.collisionReductionFactor = this.parseFloat(block); break;
				case 'CLDR': this.data.fCollidable = this.parseBool(block); break; // originally "CLDRP"
				case 'ISTO': this.data.fToy = this.parseBool(block); break;
				case 'MAPH': this.data.szPhysicsMaterial = this.parseString(block, 4); break;
				case 'OVPH': this.data.fOverwritePhysics = this.parseBool(block); break;
				case 'STRE': this.data.staticRendering = this.parseBool(block); break;
				case 'DILI': this.data.fDisableLightingTop = this.parseFloat(block); break; // m_d.m_fDisableLightingTop = (tmp == 1) ? 1.f : dequantizeUnsigned<8>(tmp); // backwards compatible hacky loading!
				case 'DILB': this.data.fDisableLightingBelow = this.parseFloat(block); break;
				case 'U3DM': this.data.use3DMesh = this.parseBool(block); break;
				case 'EBFC': this.data.fBackfacesEnabled = this.parseBool(block); break;
				case 'DIPT': this.data.fDisplayTexture = this.parseBool(block); break;
				case 'M3DN': this.data.meshFileName = this.parseWideString(block); break;
				case 'M3VN':
					this.numVertices = this.parseInt(block);
					this.mesh.animationFrames = [];
					break;
				case 'M3DX': this.mesh.vertices = this.parseVertices(block.data, this.numVertices); break;
				case 'M3AY': this.compressedAnimationVertices = this.parseInt(block); break;
				case 'M3AX': this.mesh.animationFrames.push(await this.parseAnimatedVertices(block, this.numVertices)); break;
				case 'M3CY': this.compressedVertices = this.parseInt(block); break;
				case 'M3CX': this.mesh.vertices = this.parseVertices(await BiffParser.decompress(block.data), this.numVertices); break;
				case 'M3FN': this.numIndices = this.parseInt(block); break;
				case 'M3DI': this.mesh.indices = this.parseUnsignedInts(block.data, this.numIndices); break;
				case 'M3CJ': this.compressedIndices = this.parseInt(block); break;
				case 'M3CI': this.mesh.indices = this.parseUnsignedInts(await BiffParser.decompress(block.data), this.numIndices); break;
				case 'PIDB': this.data.depthBias = this.parseFloat(block); break;
				default:
					this.parseUnknownBlock(block);
					break;
			}
		}
	}

	private parseVertices(decompressedBuffer: Buffer, num: number): Vertex3DNoTex2[] {
		const vertices: Vertex3DNoTex2[] = [];
		for (let i = 0; i < num; i++) {
			vertices.push(new Vertex3DNoTex2(decompressedBuffer, i, num));
		}
		return vertices;
	}

	private async parseAnimatedVertices(block: BiffBlock, num: number): Promise<FrameData> {
		return new FrameData(await BiffParser.decompress(block.data), num);
	}
}

class Mesh {

	private static exportPrecision = 6;

	public vertices: Vertex3DNoTex2[];
	public animationFrames: FrameData[];
	public indices: number[];
	private faceIndexOffset = 0;

	public async exportToObj(fileName: string, description: string): Promise<void> {

		const objFile: string[] = [];
		const mtlFile: string[] = [];

		this._writeHeader(objFile, mtlFile, basename(fileName) + '.wt');
		this._writeObjectName(objFile, description);
		this._writeVertexInfo(objFile);
		this._writeFaceInfoLong(objFile);

		await FileUtil.writeFile(fileName, objFile.join('\n'));
		logger.info(null, '[Mesh.exportToObj] Exported OBJ of %s to %s.', description, fileName);
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

class PrimitiveData {

	public vPosition: Vector3;
	public vSize: Vector3;
	public aRotAndTra: number[] = [];
	public szImage: string;
	public szNormalMap: string;
	public Sides: number;
	public szMaterial: string;
	public SideColor: string;
	public fVisible: boolean;
	public fReflectionEnabled: boolean;
	public DrawTexturesInside: boolean;
	public fHitEvent: boolean;
	public threshold: number;
	public elasticity: number;
	public elasticityFalloff: number;
	public friction: number;
	public scatter: number;
	public edgeFactorUI: number;
	public collisionReductionFactor: number;
	public fCollidable: boolean;
	public fToy: boolean;
	public szPhysicsMaterial: string;
	public fOverwritePhysics: boolean;
	public staticRendering: boolean;
	public fDisableLightingTop: number;
	public fDisableLightingBelow: number;
	public use3DMesh: boolean;
	public fBackfacesEnabled: boolean;
	public fDisplayTexture: boolean;
	public meshFileName: string;
	public depthBias: number;
}

class Vector3 {
	public x: number;
	public y: number;
	public z: number;

	constructor(block: BiffBlock) {
		this.x = block.data.readFloatLE(0);
		this.y = block.data.readFloatLE(4);
		this.z = block.data.readFloatLE(8);
	}
}

class Vertex3DNoTex2 {

	public static size = 32;

	public x: number;
	public y: number;
	public z: number;

	public nx: number;
	public ny: number;
	public nz: number;

	public tu: number;
	public tv: number;

	constructor(buffer: Buffer, pos: number, num: number) {
		const offset = pos * Vertex3DNoTex2.size;
		if (buffer.length < offset + Vertex3DNoTex2.size) {
			throw new Error('Cannot parse vertice number ' + pos + '/' + num + ' at position ' + offset + ' when buffer is only ' + buffer.length + ' bytes long.');
		}
		this.x = buffer.readFloatLE(offset);
		this.y = buffer.readFloatLE(offset + 4);
		this.z = buffer.readFloatLE(offset + 8);
		this.nx = buffer.readFloatLE(offset + 12);
		this.ny = buffer.readFloatLE(offset + 16);
		this.nz = buffer.readFloatLE(offset + 20);
		this.tu = buffer.readFloatLE(offset + 24);
		this.tv = buffer.readFloatLE(offset + 28);
	}
}

class FrameData {
	public frameVerts: VertData[] = [];
	constructor(buffer: Buffer, numVertices: number) {
		for (let i = 0; i < numVertices; i++) {
			this.frameVerts.push(new VertData(buffer, i * 24));
		}
	}
}

class VertData {

	public x: number;
	public y: number;
	public z: number;

	public nx: number;
	public ny: number;
	public nz: number;

	constructor(buffer: Buffer, offset: number = 0) {
		this.x = buffer.readFloatLE(offset);
		this.y = buffer.readFloatLE(offset + 4);
		this.z = buffer.readFloatLE(offset + 8);
		this.nx = buffer.readFloatLE(offset + 12);
		this.ny = buffer.readFloatLE(offset + 16);
		this.nz = buffer.readFloatLE(offset + 20);
	}
}
