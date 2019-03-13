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

import { logger } from '../common/logger';
import { settings } from '../common/settings';
import { FileUtil } from '../files/file.util';
import { BiffBlock, BiffParser } from './biff-parser';
import { FrameData, Mesh, Vector3, Vertex3DNoTex2 } from './common';
import { GameItem } from './game-item';

export class PrimitiveItem extends GameItem {

	public static async load(buffer: Buffer): Promise<PrimitiveItem> {
		const primitiveItem = new PrimitiveItem();
		await primitiveItem._load(buffer);
		return primitiveItem;
	}

	public static from(data: any): PrimitiveItem {
		const primitiveItem = new PrimitiveItem();
		primitiveItem.data = PrimitiveData.from(data.data);
		primitiveItem.mesh = Mesh.from(data.mesh);
		primitiveItem.numVertices = data.numVertices;
		primitiveItem.compressedAnimationVertices = data.compressedAnimationVertices;
		primitiveItem.compressedVertices = data.compressedVertices;
		primitiveItem.pdata = data.pdata;
		primitiveItem.wzName = data.wzName;
		primitiveItem.numIndices = data.numIndices;
		primitiveItem.compressedIndices = data.compressedIndices;
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
		const description = this.data.use3DMesh ? this.wzName : 'Primitive';
		const obj = this.mesh.serializeToObj(description);
		await FileUtil.writeFile(fileName, obj);
		logger.info(null, '[Mesh.serializeToObj] Exported OBJ of %s to %s.', description, fileName);
	}

	public serialize(fileId: string) {
		return {
			name: this.wzName,
			mesh: settings.apiExternalUri(`/v1/vp/${fileId}/meshes/${encodeURI(this.wzName)}.obj`),
			pos: this.data.vPosition,
			size: this.data.vSize,
			rot: {
				x: this.data.aRotAndTra[0],
				y: this.data.aRotAndTra[1],
				z: this.data.aRotAndTra[2],
			},
			trans: {
				x: this.data.aRotAndTra[3],
				y: this.data.aRotAndTra[4],
				z: this.data.aRotAndTra[5],
			},
			obj_rot: {
				x: this.data.aRotAndTra[6],
				y: this.data.aRotAndTra[7],
				z: this.data.aRotAndTra[8],
			},
			is_visible: this.data.fVisible,
			textureMap: this.data.szImage,
			normalMap: this.data.szNormalMap,
			material: this.data.szMaterial,
		};
	}

	public serializeToObj() {
		const description = this.data.use3DMesh ? this.wzName : 'Primitive';
		return this.mesh.serializeToObj(description);
	}

	private async _load(buffer: Buffer) {
		const blocks = BiffParser.parseBiff(buffer, 4);
		for (const block of blocks) {
			switch (block.tag) {
				case 'PIID': this.pdata = this.parseInt(buffer, block); break;
				case 'VPOS': this.data.vPosition = Vector3.load(buffer, block); break;
				case 'VSIZ': this.data.vSize = Vector3.load(buffer, block); break;
				case 'RTV0': this.data.aRotAndTra[0] = this.parseFloat(buffer, block); break;
				case 'RTV1': this.data.aRotAndTra[1] = this.parseFloat(buffer, block); break;
				case 'RTV2': this.data.aRotAndTra[2] = this.parseFloat(buffer, block); break;
				case 'RTV3': this.data.aRotAndTra[3] = this.parseFloat(buffer, block); break;
				case 'RTV4': this.data.aRotAndTra[4] = this.parseFloat(buffer, block); break;
				case 'RTV5': this.data.aRotAndTra[5] = this.parseFloat(buffer, block); break;
				case 'RTV6': this.data.aRotAndTra[6] = this.parseFloat(buffer, block); break;
				case 'RTV7': this.data.aRotAndTra[7] = this.parseFloat(buffer, block); break;
				case 'RTV8': this.data.aRotAndTra[8] = this.parseFloat(buffer, block); break;
				case 'IMAG': this.data.szImage = this.parseString(buffer, block, 4); break;
				case 'NRMA': this.data.szNormalMap = this.parseString(buffer, block, 4); break;
				case 'SIDS': this.data.Sides = this.parseInt(buffer, block); break;
				case 'NAME': this.wzName = this.parseWideString(buffer, block); break;
				case 'MATR': this.data.szMaterial = this.parseString(buffer, block, 4); break;
				case 'SCOL': this.data.SideColor = this.parseString(buffer, block, 4); break;
				case 'TVIS': this.data.fVisible = this.parseBool(buffer, block); break;
				case 'REEN': this.data.fReflectionEnabled = this.parseBool(buffer, block); break;
				case 'DTXI': this.data.DrawTexturesInside = this.parseBool(buffer, block); break;
				case 'HTEV': this.data.fHitEvent = this.parseBool(buffer, block); break;
				case 'THRS': this.data.threshold = this.parseFloat(buffer, block); break;
				case 'ELAS': this.data.elasticity = this.parseFloat(buffer, block); break;
				case 'ELFO': this.data.elasticityFalloff = this.parseFloat(buffer, block); break;
				case 'RFCT': this.data.friction = this.parseFloat(buffer, block); break;
				case 'RSCT': this.data.scatter = this.parseFloat(buffer, block); break;
				case 'EFUI': this.data.edgeFactorUI = this.parseFloat(buffer, block); break;
				case 'CORF': this.data.collisionReductionFactor = this.parseFloat(buffer, block); break;
				case 'CLDR': this.data.fCollidable = this.parseBool(buffer, block); break; // originally "CLDRP"
				case 'ISTO': this.data.fToy = this.parseBool(buffer, block); break;
				case 'MAPH': this.data.szPhysicsMaterial = this.parseString(buffer, block, 4); break;
				case 'OVPH': this.data.fOverwritePhysics = this.parseBool(buffer, block); break;
				case 'STRE': this.data.staticRendering = this.parseBool(buffer, block); break;
				case 'DILI': this.data.fDisableLightingTop = this.parseFloat(buffer, block); break; // m_d.m_fDisableLightingTop = (tmp == 1) ? 1.f : dequantizeUnsigned<8>(tmp); // backwards compatible hacky loading!
				case 'DILB': this.data.fDisableLightingBelow = this.parseFloat(buffer, block); break;
				case 'U3DM': this.data.use3DMesh = this.parseBool(buffer, block); break;
				case 'EBFC': this.data.fBackfacesEnabled = this.parseBool(buffer, block); break;
				case 'DIPT': this.data.fDisplayTexture = this.parseBool(buffer, block); break;
				case 'M3DN': this.data.meshFileName = this.parseWideString(buffer, block); break;
				case 'M3VN':
					this.numVertices = this.parseInt(buffer, block);
					this.mesh.animationFrames = [];
					break;
				case 'M3DX': this.mesh.vertices = this.parseVertices(buffer, block, this.numVertices); break;
				case 'M3AY': this.compressedAnimationVertices = this.parseInt(buffer, block); break;
				case 'M3AX': this.mesh.animationFrames.push(await this.parseAnimatedVertices(buffer, block, this.numVertices)); break;
				case 'M3CY': this.compressedVertices = this.parseInt(buffer, block); break;
				case 'M3CX': this.mesh.vertices = this.parseVertices(await BiffParser.decompress(buffer, block), null, this.numVertices); break;
				case 'M3FN': this.numIndices = this.parseInt(buffer, block); break;
				case 'M3DI': this.mesh.indices = this.parseUnsignedInt2s(buffer, block, this.numIndices); break;
				case 'M3CJ': this.compressedIndices = this.parseInt(buffer, block); break;
				case 'M3CI': this.mesh.indices = this.parseUnsignedInt2s(await BiffParser.decompress(buffer, block), null, this.numIndices); break;
				case 'PIDB': this.data.depthBias = this.parseFloat(buffer, block); break;
				default:
					this.parseUnknownBlock(buffer, block);
					break;
			}
		}
	}

	private parseVertices(decompressedBuffer: Buffer, block: BiffBlock, num: number): Vertex3DNoTex2[] {
		block = block || { pos: 0, len: decompressedBuffer.length };
		const vertices: Vertex3DNoTex2[] = [];
		for (let i = 0; i < num; i++) {
			vertices.push(Vertex3DNoTex2.load(decompressedBuffer, block, i, num));
		}
		return vertices;
	}

	private async parseAnimatedVertices(buffer: Buffer, block: BiffBlock, num: number): Promise<FrameData> {
		return FrameData.load(await BiffParser.decompress(buffer, block), num);
	}
}

class PrimitiveData {

	public static from(data: any): PrimitiveData {
		const primitiveData: PrimitiveData = Object.assign(new PrimitiveData(), data);
		primitiveData.vPosition = Vector3.from(data.vPosition);
		primitiveData.vSize = Vector3.from(data.vSize);
		return primitiveData;
	}

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
