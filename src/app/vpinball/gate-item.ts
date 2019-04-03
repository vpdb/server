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
import { logger } from '../common/logger';
import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { GameItem, IRenderable, Meshes } from './game-item';
import { Matrix3D } from './matrix3d';
import { Mesh } from './mesh';
import { hitTargetT3Mesh } from './meshes/drop-target-t3-mesh';
import { gateBracketMesh } from './meshes/gate-bracket-mesh';
import { gateLongPlateMesh } from './meshes/gate-long-plate-mesh';
import { gatePlateMesh } from './meshes/gate-plate-mesh';
import { gateWireMesh } from './meshes/gate-wire-mesh';
import { gateWireRectangleMesh } from './meshes/gate-wire-rectangle-mesh';
import { Vertex2D, Vertex3D } from './vertex';
import { VpTable } from './vp-table';

export class GateItem extends GameItem implements IRenderable {

	public static TypeGateWireW = 1;
	public static TypeGateWireRectangle = 2;
	public static TypeGatePlate = 3;
	public static TypeGateLongPlate = 4;

	private pdata: number;
	private gateType: number;
	private vCenter: Vertex2D;
	private length: number;
	private height: number;
	private rotation: number;
	private szMaterial: string;
	private fTimerEnabled: boolean;
	private fShowBracket: boolean;
	private fCollidable: boolean;
	private twoWay: boolean;
	private fVisible: boolean;
	private fReflectionEnabled: boolean;
	private TimerInterval: number;
	private szSurface: string;
	private wzName: string;
	private elasticity: number;
	private angleMax: number;
	private angleMin: number;
	private friction: number;
	private damping: number;
	private gravityfactor: number;

	public static async fromStorage(storage: Storage, itemName: string): Promise<GateItem> {
		const gateItem = new GateItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(gateItem.fromTag.bind(gateItem), {}));
		return gateItem;
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.fVisible;
	}

	public getMeshes(table: VpTable): Meshes {
		const meshes: Meshes = {};
		const baseHeight = table.getSurfaceHeight(this.szSurface, this.vCenter.x, this.vCenter.y) * table.getScaleZ();

		// wire mesh
		const wireMesh = this.positionMesh(this.getBaseMesh(), table, baseHeight);
		wireMesh.name = `gate-wire:${this.getName()}`;
		meshes.wire = {
			mesh: wireMesh.transform(new Matrix3D().toRightHanded()),
			material: table.getMaterial(this.szMaterial),
		};

		// bracket mesh
		if (this.fShowBracket) {
			const bracketMesh = this.positionMesh(gateBracketMesh.clone(), table, baseHeight);
			bracketMesh.name = `gate-bracket:${this.getName()}`;
			meshes.bracket = {
				mesh: bracketMesh.transform(new Matrix3D().toRightHanded()),
				material: table.getMaterial(this.szMaterial),
			};
		}
		return meshes;
	}

	private getBaseMesh(): Mesh {
		switch (this.gateType) {
			case GateItem.TypeGateWireW: return gateWireMesh.clone();
			case GateItem.TypeGateWireRectangle: return gateWireRectangleMesh.clone();
			case GateItem.TypeGatePlate: return gatePlateMesh.clone();
			case GateItem.TypeGateLongPlate: return gateLongPlateMesh.clone();
			default:
				logger.warn(null, '[GateItem.getBaseMesh] Unknown gate type "%s".', this.gateType);
				return hitTargetT3Mesh.clone();
		}
	}

	private positionMesh(mesh: Mesh, table: VpTable, baseHeight: number): Mesh {
		const fullMatrix = new Matrix3D();
		fullMatrix.rotateZMatrix(M.degToRad(this.rotation));
		for (const vertex of mesh.vertices) {

			let vert = new Vertex3D(vertex.x, vertex.y, vertex.z);
			vert = fullMatrix.multiplyVector(vert);
			vertex.x = vert.x * this.length + this.vCenter.x;
			vertex.y = vert.y * this.length + this.vCenter.y;
			vertex.z = vert.z * this.length * table.getScaleZ() + (this.height * table.getScaleZ() + baseHeight);

			vert = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			vert = fullMatrix.multiplyVectorNoTranslate(vert);
			vertex.nx = vert.x;
			vertex.ny = vert.y;
			vertex.nz = vert.z;
		}
		return mesh;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'GATY':
				this.gateType = this.getInt(buffer);
				if (this.gateType < GateItem.TypeGateWireW || this.gateType > GateItem.TypeGateLongPlate) {// for tables that were saved in the phase where m_type could've been undefined
					this.gateType = GateItem.TypeGateWireW;
				}
				break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'LGTH': this.length = this.getFloat(buffer); break;
			case 'HGTH': this.height = this.getFloat(buffer); break;
			case 'ROTA': this.rotation = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'GSUP': this.fShowBracket = this.getBool(buffer); break;
			case 'GCOL': this.fCollidable = this.getBool(buffer); break;
			case 'TWWA': this.twoWay = this.getBool(buffer); break;
			case 'GVSB': this.fVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'GAMA': this.angleMax = this.getFloat(buffer); break;
			case 'GAMI': this.angleMin = this.getFloat(buffer); break;
			case 'GFRC': this.friction = this.getFloat(buffer); break;
			case 'AFRC': this.damping = this.getFloat(buffer); break;
			case 'GGFC': this.gravityfactor = this.getFloat(buffer); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
		return 0;
	}
}
