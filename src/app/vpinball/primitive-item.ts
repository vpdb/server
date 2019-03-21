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
import { Storage } from '../common/ole-doc';
import { settings } from '../common/settings';
import { FileUtil } from '../files/file.util';
import { BiffParser } from './biff-parser';
import { FrameData, Vector3 } from './common';
import { GameItem } from './game-item';
import { IPositionable, Mesh } from './mesh';
import { Vertex3D, Vertex3DNoTex2 } from './vertex';

export class PrimitiveItem extends GameItem implements IPositionable {

	public static async fromStorage(storage: Storage, itemName: string): Promise<PrimitiveItem> {
		const primitiveItem = new PrimitiveItem();
		await storage.streamFiltered(itemName, 4, BiffParser
			.stream((buffer, tag, offset, len) => primitiveItem.fromTag(buffer, tag, offset, len, storage, itemName)));
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

	public getPosition(): Vertex3D {
		return new Vertex3D(this.data.vPosition.x, this.data.vPosition.y, this.data.vPosition.z);
	}

	public getRotation(): Vertex3D {
		return new Vertex3D(this.data.aRotAndTra[0], this.data.aRotAndTra[1], this.data.aRotAndTra[2]);
	}

	public getTransition(): Vertex3D {
		return new Vertex3D(this.data.aRotAndTra[3], this.data.aRotAndTra[4], this.data.aRotAndTra[5]);
	}

	public getObjectRotation(): Vertex3D {
		return new Vertex3D(this.data.aRotAndTra[6], this.data.aRotAndTra[7], this.data.aRotAndTra[8]);
	}

	public getScale(): Vertex3D {
		return new Vertex3D(this.data.vSize.x, this.data.vSize.y, this.data.vSize.z);
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

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number, storage: Storage, itemName: string): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VPOS': this.data.vPosition = Vector3.get(buffer); break;
			case 'VSIZ': this.data.vSize = Vector3.get(buffer); break;
			case 'RTV0': this.data.aRotAndTra[0] = this.getFloat(buffer); break;
			case 'RTV1': this.data.aRotAndTra[1] = this.getFloat(buffer); break;
			case 'RTV2': this.data.aRotAndTra[2] = this.getFloat(buffer); break;
			case 'RTV3': this.data.aRotAndTra[3] = this.getFloat(buffer); break;
			case 'RTV4': this.data.aRotAndTra[4] = this.getFloat(buffer); break;
			case 'RTV5': this.data.aRotAndTra[5] = this.getFloat(buffer); break;
			case 'RTV6': this.data.aRotAndTra[6] = this.getFloat(buffer); break;
			case 'RTV7': this.data.aRotAndTra[7] = this.getFloat(buffer); break;
			case 'RTV8': this.data.aRotAndTra[8] = this.getFloat(buffer); break;
			case 'IMAG': this.data.szImage = this.getString(buffer, len); break;
			case 'NRMA': this.data.szNormalMap = this.getString(buffer, len); break;
			case 'SIDS': this.data.Sides = this.getInt(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'MATR': this.data.szMaterial = this.getString(buffer, len); break;
			case 'SCOL': this.data.SideColor = this.getString(buffer, len); break;
			case 'TVIS': this.data.fVisible = this.getBool(buffer); break;
			case 'REEN': this.data.fReflectionEnabled = this.getBool(buffer); break;
			case 'DTXI': this.data.DrawTexturesInside = this.getBool(buffer); break;
			case 'HTEV': this.data.fHitEvent = this.getBool(buffer); break;
			case 'THRS': this.data.threshold = this.getFloat(buffer); break;
			case 'ELAS': this.data.elasticity = this.getFloat(buffer); break;
			case 'ELFO': this.data.elasticityFalloff = this.getFloat(buffer); break;
			case 'RFCT': this.data.friction = this.getFloat(buffer); break;
			case 'RSCT': this.data.scatter = this.getFloat(buffer); break;
			case 'EFUI': this.data.edgeFactorUI = this.getFloat(buffer); break;
			case 'CORF': this.data.collisionReductionFactor = this.getFloat(buffer); break;
			case 'CLDR': this.data.fCollidable = this.getBool(buffer); break; // originally "CLDRP"
			case 'ISTO': this.data.fToy = this.getBool(buffer); break;
			case 'MAPH': this.data.szPhysicsMaterial = this.getString(buffer, len); break;
			case 'OVPH': this.data.fOverwritePhysics = this.getBool(buffer); break;
			case 'STRE': this.data.staticRendering = this.getBool(buffer); break;
			case 'DILI': this.data.fDisableLightingTop = this.getFloat(buffer); break; // m_d.m_fDisableLightingTop = (tmp == 1) ? 1.f : dequantizeUnsigned<8>(tmp); // backwards compatible hacky loading!
			case 'DILB': this.data.fDisableLightingBelow = this.getFloat(buffer); break;
			case 'U3DM': this.data.use3DMesh = this.getBool(buffer); break;
			case 'EBFC': this.data.fBackfacesEnabled = this.getBool(buffer); break;
			case 'DIPT': this.data.fDisplayTexture = this.getBool(buffer); break;
			case 'M3DN': this.data.meshFileName = this.getWideString(buffer, len); break;
			case 'M3VN':
				this.numVertices = this.getInt(buffer);
				this.mesh.animationFrames = [];
				break;
			case 'M3DX': this.mesh.vertices = this.getVertices(buffer, this.numVertices); break;
			case 'M3AY': this.compressedAnimationVertices = this.getInt(buffer); break;
			case 'M3AX': this.mesh.animationFrames.push(await this.getAnimatedVertices(await BiffParser.decompress(await this.getData(buffer, offset, len, storage, itemName), len), this.numVertices)); break;
			case 'M3CY': this.compressedVertices = this.getInt(buffer); break;
			case 'M3CX': this.mesh.vertices = this.getVertices(await BiffParser.decompress(await this.getData(buffer, offset, len, storage, itemName), len), this.numVertices); break;
			case 'M3FN': this.numIndices = this.getInt(buffer); break;
			case 'M3DI': this.mesh.indices = this.getUnsignedInt2s(buffer, this.numIndices); break;
			case 'M3CJ': this.compressedIndices = this.getInt(buffer); break;
			case 'M3CI': this.mesh.indices = this.getUnsignedInt2s(await BiffParser.decompress(await this.getData(buffer, offset, len, storage, itemName), len), this.numIndices); break;
			case 'PIDB': this.data.depthBias = this.getFloat(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}

	private async getData(buffer: Buffer, offset: number, len: number, storage: Storage, itemName: string): Promise<Buffer> {
		if (buffer.length === len) {
			return buffer;
		}
		return storage.read(itemName, offset, len);
	}

	private getVertices(decompressedBuffer: Buffer, num: number): Vertex3DNoTex2[] {
		const vertices: Vertex3DNoTex2[] = [];
		for (let i = 0; i < num; i++) {
			vertices.push(Vertex3DNoTex2.get(decompressedBuffer, i));
		}
		return vertices;
	}

	private async getAnimatedVertices(buffer: Buffer, num: number): Promise<FrameData> {
		return FrameData.get(buffer, num);
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
