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

import { Math as M } from 'three';
import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { GameItem, IRenderable, Meshes } from './game-item';
import { Matrix3D } from './matrix3d';
import { Mesh } from './mesh';
import { kickerCupMesh } from './meshes/kicker-cup-mesh';
import { kickerGottliebMesh } from './meshes/kicker-gottlieb-mesh';
import { kickerHoleMesh } from './meshes/kicker-hole-mesh';
import { kickerSimpleHoleMesh } from './meshes/kicker-simple-hole-mesh';
import { kickerT1Mesh } from './meshes/kicker-t1-mesh';
import { kickerWilliamsMesh } from './meshes/kicker-williams-mesh';
import { Vertex2D, Vertex3D } from './vertex';
import { VpTable } from './vp-table';

/**
 * VPinball's kickers.
 *
 * @see https://github.com/vpinball/vpinball/blob/master/kicker.cpp
 */
export class KickerItem extends GameItem implements IRenderable {

	public static TypeKickerInvisible = 0;
	public static TypeKickerHole = 1;
	public static TypeKickerCup = 2;
	public static TypeKickerHoleSimple = 3;
	public static TypeKickerWilliams = 4;
	public static TypeKickerGottlieb = 5;
	public static TypeKickerCup2 = 6;

	private pdata: number;
	private kickerType: number;
	private vCenter: Vertex2D;
	private radius: number;
	private scatter: number;
	private hitAccuracy: number;
	private hitHeight: number;
	private orientation: number;
	private szMaterial: string;
	private fTimerEnabled: boolean;
	private fEnabled: boolean;
	private TimerInterval: number;
	private szSurface: string;
	private wzName: string;
	private fFallThrough: boolean;
	private legacyMode: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<KickerItem> {
		const kickerItem = new KickerItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(kickerItem.fromTag.bind(kickerItem), {}));
		return kickerItem;
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.kickerType !== KickerItem.TypeKickerInvisible;
	}

	public getMeshes(table: VpTable): Meshes {
		const baseHeight = table.getSurfaceHeight(this.szSurface, this.vCenter.x, this.vCenter.y) * table.getScaleZ();
		const kickerMesh = this.generateMesh(table, baseHeight);
		return {
			kicker: {
				mesh: kickerMesh.transform(new Matrix3D().toRightHanded()),
				material: table.getMaterial(this.szMaterial),
			},
		};
	}

	private generateMesh(table: VpTable, baseHeight: number): Mesh {
		let zOffset = 0.0;
		let zRot = this.orientation;
		switch (this.kickerType) {
			case KickerItem.TypeKickerCup:
				zOffset = -0.18;
				break;
			case KickerItem.TypeKickerWilliams:
				zRot = this.orientation + 90.0;
				break;
			case KickerItem.TypeKickerHole:
				zRot = 0.0;
				break;
			case KickerItem.TypeKickerHoleSimple:
			default:
				zRot = 0.0;
				break;
		}
		const fullMatrix = new Matrix3D();
		fullMatrix.rotateZMatrix(M.degToRad(zRot));

		const mesh = this.getBaseMesh();
		for (const vertex of mesh.vertices) {
			let vert = new Vertex3D(vertex.x, vertex.y, vertex.z + zOffset);
			vert = fullMatrix.multiplyVector(vert);

			vertex.x = vert.x * this.radius + this.vCenter.x;
			vertex.y = vert.y * this.radius + this.vCenter.y;
			vertex.z = vert.z * this.radius * table.getScaleZ() + baseHeight;

			vert = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			vert = fullMatrix.multiplyVectorNoTranslate(vert);
			vertex.nx = vert.x;
			vertex.ny = vert.y;
			vertex.nz = vert.z;
		}
		return mesh;
	}

	private getBaseMesh(): Mesh {
		const name = `kicker:${this.getName()}`;
		switch (this.kickerType) {
			case KickerItem.TypeKickerCup: return kickerCupMesh.clone(name);
			case KickerItem.TypeKickerWilliams: return kickerWilliamsMesh.clone(name);
			case KickerItem.TypeKickerGottlieb: return kickerGottliebMesh.clone(name);
			case KickerItem.TypeKickerCup2: return kickerT1Mesh.clone(name);
			case KickerItem.TypeKickerHole: return kickerHoleMesh.clone(name);
			case KickerItem.TypeKickerHoleSimple:
			default:
				return kickerSimpleHoleMesh.clone(name);
		}
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.radius = this.getFloat(buffer); break;
			case 'KSCT': this.scatter = this.getFloat(buffer); break;
			case 'KHAC': this.hitAccuracy = this.getFloat(buffer); break;
			case 'KHHI': this.hitHeight = this.getFloat(buffer); break;
			case 'KORI': this.orientation = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'EBLD': this.fEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'TYPE':
				this.kickerType = this.getInt(buffer);
				//legacy handling:
				if (this.kickerType > KickerItem.TypeKickerCup2) {
					this.kickerType = KickerItem.TypeKickerInvisible;
				}
				break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'FATH': this.fFallThrough = this.getBool(buffer); break;
			case 'LEMO': this.legacyMode = this.getBool(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
		return 0;
	}
}
