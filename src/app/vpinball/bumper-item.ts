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

import { Math as M, Matrix4 } from 'three';
import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { GameItem, IRenderable, Meshes } from './game-item';
import { Mesh } from './mesh';
import { bumperBaseMesh } from './meshes/bumper-base-mesh';
import { bumperCapMesh } from './meshes/bumper-cap-mesh';
import { bumperRingMesh } from './meshes/bumper-ring-mesh';
import { bumperSocketMesh } from './meshes/bumper-socket-mesh';
import { Vertex2D, Vertex3D } from './vertex';
import { VpTable } from './vp-table';

export class BumperItem extends GameItem implements IRenderable {

	public pdata: number;
	public vCenter: Vertex2D;
	public radius: number;
	public szCapMaterial: string;
	public szRingMaterial: string;
	public szBaseMaterial: string;
	public szSkirtMaterial: string;
	public TimerInterval: number;
	public fTimerEnabled: boolean;
	public threshold: number;
	public force: number;
	public scatter: number;
	public heightScale: number;
	public ringSpeed: number;
	public orientation: number;
	public ringDropOffset: number;
	public szSurface: string;
	public wzName: string;
	public fCapVisible: boolean;
	public fBaseVisible: boolean;
	public fRingVisible: boolean;
	public fSkirtVisible: boolean;
	public fHitEvent: boolean;
	public fCollidable: boolean;
	public fReflectionEnabled: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<BumperItem> {
		const bumperItem = new BumperItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(bumperItem.fromTag.bind(bumperItem)));
		return bumperItem;
	}

	public static from(data: any): BumperItem {
		const bumperItem = new BumperItem();
		Object.assign(bumperItem, data);
		return bumperItem;
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.fBaseVisible || this.fRingVisible || this.fSkirtVisible || this.fCapVisible;
	}

	public getMeshes(table: VpTable): Meshes {
		const meshes: Meshes = {};
		const matrix = new Matrix4();
		matrix.makeRotationZ(M.radToDeg(this.orientation));
		const height = table.getSurfaceHeight(this.szSurface, this.vCenter.x, this.vCenter.y) * table.getScaleZ();
		if (this.fBaseVisible) {
			meshes.base = {
				mesh: this.generateMesh(bumperBaseMesh, matrix, z => z * this.heightScale * table.getScaleZ() + height),
				material: table.getMaterial(this.szBaseMaterial),
			};
		}
		if (this.fRingVisible) {
			meshes.ring = {
				mesh: this.generateMesh(bumperRingMesh, matrix, z => z * (this.heightScale * table.getScaleZ()) + height),
				material: table.getMaterial(this.szRingMaterial),
			};
		}
		if (this.fSkirtVisible) {
			meshes.skirt = {
				mesh: this.generateMesh(bumperSocketMesh, matrix, z => z * (this.heightScale * table.getScaleZ()) + (height + 5.0)),
				material: table.getMaterial(this.szSkirtMaterial),
			};
		}
		if (this.fCapVisible) {
			meshes.cap = {
				mesh: this.generateMesh(bumperCapMesh, matrix, z => (z * this.heightScale + this.heightScale) * table.getScaleZ() + height),
				material: table.getMaterial(this.szCapMaterial),
			};
		}
		return meshes;
	}

	private generateMesh(mesh: Mesh, matrix: Matrix4, zPos: (z: number) => number): Mesh {
		const scalexy = this.radius;
		const generatedMesh = mesh.clone();
		for (const vertex of generatedMesh.vertices) {
			let vert = new Vertex3D(vertex.x, vertex.y, vertex.z);
			vert.applyMatrix4(matrix);
			vertex.x = vert.x * scalexy + this.vCenter.x;
			vertex.y = vert.y * scalexy + this.vCenter.y;
			vertex.z = zPos(vert.z);

			vert = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			vert.applyMatrix4(matrix);
			vertex.nx = vert.x;
			vertex.ny = vert.y;
			vertex.nz = vert.z;
		}
		return generatedMesh;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.radius = this.getFloat(buffer); break;
			case 'MATR': this.szCapMaterial = this.getString(buffer, len); break;
			case 'RIMA': this.szRingMaterial = this.getString(buffer, len); break;
			case 'BAMA': this.szBaseMaterial = this.getString(buffer, len); break;
			case 'SKMA': this.szSkirtMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'THRS': this.threshold = this.getFloat(buffer); break;
			case 'FORC': this.force = this.getFloat(buffer); break;
			case 'BSCT': this.scatter = this.getFloat(buffer); break;
			case 'HISC': this.heightScale = this.getFloat(buffer); break;
			case 'RISP': this.ringSpeed = this.getFloat(buffer); break;
			case 'ORIN': this.orientation = this.getFloat(buffer); break;
			case 'RDLI': this.ringDropOffset = this.getFloat(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'BVIS':
				const isVisible = this.getBool(buffer);
				this.fCapVisible = isVisible;
				this.fBaseVisible = isVisible;
				this.fRingVisible = isVisible;
				this.fSkirtVisible = isVisible;
				break;
			case 'CAVI': this.fCapVisible = this.getBool(buffer); break;
			case 'HAHE': this.fHitEvent = this.getBool(buffer); break;
			case 'COLI': this.fCollidable = this.getBool(buffer); break;
			case 'BSVS':
				this.fBaseVisible = this.getBool(buffer);
				this.fRingVisible = this.fBaseVisible;
				this.fSkirtVisible = this.fBaseVisible;
				break;
			case 'RIVS': this.fRingVisible = this.getBool(buffer); break;
			case 'SKVS': this.fSkirtVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
		return 0;
	}
}
