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
import { hitTargetT2Mesh } from './meshes/drop-target-t2-mesh';
import { hitTargetT3Mesh } from './meshes/drop-target-t3-mesh';
import { hitTargetT4Mesh } from './meshes/drop-target-t4-mesh';
import { hitFatTargetRectangleMesh } from './meshes/hit-target-fat-rectangle-mesh';
import { hitFatTargetSquareMesh } from './meshes/hit-target-fat-square-mesh';
import { hitTargetRectangleMesh } from './meshes/hit-target-rectangle-mesh';
import { hitTargetRoundMesh } from './meshes/hit-target-round-mesh';
import { hitTargetT1SlimMesh } from './meshes/hit-target-t1-slim-mesh';
import { hitTargetT2SlimMesh } from './meshes/hit-target-t2-slim-mesh';
import { Vertex3D } from './vertex';
import { VpTable } from './vp-table';

export class HitTargetItem extends GameItem implements IRenderable {

	private static TypeDropTargetBeveled = 1;
	private static TypeDropTargetSimple = 2;
	private static TypeHitTargetRound = 3;
	private static TypeHitTargetRectangle = 4;
	private static TypeHitFatTargetRectangle = 5;
	private static TypeHitFatTargetSquare = 6;
	private static TypeDropTargetFlatSimple = 7;
	private static TypeHitFatTargetSlim = 8;
	private static TypeHitTargetSlim = 9;

	private pdata: number;
	private vPosition: Vertex3D;
	private vSize: Vertex3D;
	private rotZ: number;
	private szImage: string;
	private targetType: number;
	private wzName: string;
	private szMaterial: string;
	private fVisible: boolean;
	private legacy: boolean;
	private isDropped: boolean;
	private dropSpeed: number;
	private fReflectionEnabled: boolean;
	private fUseHitEvent: boolean;
	private threshold: number;
	private elasticity: number;
	private elasticityFalloff: number;
	private friction: number;
	private scatter: number;
	private fCollidable: boolean;
	private fDisableLightingTop: number;
	private fDisableLightingBelow: number;
	private depthBias: number;
	private fTimerEnabled: boolean;
	private TimerInterval: number;
	private RaiseDelay: number;
	private szPhysicsMaterial: string;
	private fOverwritePhysics: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<HitTargetItem> {
		const hitTargetItem = new HitTargetItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(hitTargetItem.fromTag.bind(hitTargetItem), {}));
		return hitTargetItem;
	}

	public static from(data: any): HitTargetItem {
		const hitTargetItem = new HitTargetItem();
		Object.assign(hitTargetItem, data);
		return hitTargetItem;
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.fVisible;
	}

	public getMeshes(table: VpTable): Meshes {
		const hitTargetMesh = this.getBaseMesh();
		hitTargetMesh.name = `hit-target:${this.getName()}`;

		const fullMatrix = new Matrix4();
		const tempMatrix = new Matrix4();
		tempMatrix.makeRotationZ(M.degToRad(this.rotZ));
		fullMatrix.multiplyMatrices(fullMatrix, tempMatrix);

		for (const vertex of hitTargetMesh.vertices) {
			let vert = new Vertex3D(vertex.x, vertex.y, vertex.z);
			vert.x *= this.vSize.x;
			vert.y *= this.vSize.y;
			vert.z *= this.vSize.z;
			vert.applyMatrix4(fullMatrix);

			vertex.x = vert.x + this.vPosition.x;
			vertex.y = vert.y + this.vPosition.y;
			vertex.z = vert.z * table.getScaleZ() + this.vPosition.z + table.getTableHeight();

			vert = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			vert.applyMatrix4(fullMatrix);
			vertex.nx = vert.x;
			vertex.ny = vert.y;
			vertex.nz = vert.z;
		}

		return {
			hitTarget: {
				mesh: hitTargetMesh,
				map: table.getTexture(this.szImage),
				material: table.getMaterial(this.szMaterial),
			},
		};
	}

	private getBaseMesh(): Mesh {
		switch (this.targetType) {
			case HitTargetItem.TypeDropTargetBeveled: return hitTargetT2Mesh.clone();
			case HitTargetItem.TypeDropTargetSimple: return hitTargetT3Mesh.clone();
			case HitTargetItem.TypeDropTargetFlatSimple: return hitTargetT4Mesh.clone();
			case HitTargetItem.TypeHitTargetRound: return hitTargetRoundMesh.clone();
			case HitTargetItem.TypeHitTargetRectangle: return hitTargetRectangleMesh.clone();
			case HitTargetItem.TypeHitFatTargetRectangle: return hitFatTargetRectangleMesh.clone();
			case HitTargetItem.TypeHitFatTargetSquare: return hitFatTargetSquareMesh.clone();
			case HitTargetItem.TypeHitTargetSlim: return hitTargetT1SlimMesh.clone();
			case HitTargetItem.TypeHitFatTargetSlim: return hitTargetT2SlimMesh.clone();
			default: return hitTargetT3Mesh.clone();
		}
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VPOS': this.vPosition = Vertex3D.get(buffer); break;
			case 'VSIZ': this.vSize = Vertex3D.get(buffer); break;
			case 'ROTZ': this.rotZ = this.getFloat(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			case 'TRTY': this.targetType = this.getInt(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TVIS': this.fVisible = this.getBool(buffer); break;
			case 'LEMO': this.legacy = this.getBool(buffer); break;
			case 'ISDR': this.isDropped = this.getBool(buffer); break;
			case 'DRSP': this.dropSpeed = this.getInt(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'HTEV': this.fUseHitEvent = this.getBool(buffer); break;
			case 'THRS': this.threshold = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'ELFO': this.elasticityFalloff = this.getFloat(buffer); break;
			case 'RFCT': this.friction = this.getFloat(buffer); break;
			case 'RSCT': this.scatter = this.getFloat(buffer); break;
			case 'CLDR': this.fCollidable = this.getBool(buffer); break;
			case 'DILI': this.fDisableLightingTop = this.getFloat(buffer); break;
			case 'DILB': this.fDisableLightingBelow = this.getFloat(buffer); break;
			case 'PIDB': this.depthBias = this.getFloat(buffer); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'RADE': this.RaiseDelay = this.getInt(buffer); break;
			case 'MAPH': this.szPhysicsMaterial = this.getString(buffer, len); break;
			case 'OVPH': this.fOverwritePhysics = this.getBool(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
		return 0;
	}
}
