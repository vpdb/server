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
import { logger } from '../common/logger';
import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { DragPoint } from './dragpoint';
import { GameItem } from './game-item';
import { Mesh, Meshes } from './mesh';
import { triggerButtonMesh } from './meshes/trigger-button-mesh';
import { triggerSimpleMesh } from './meshes/trigger-simple-mesh';
import { triggerStarMesh } from './meshes/trigger-star-mesh';
import { triggerDWireMesh } from './meshes/trigger-wire-d-mesh';
import { Vertex2D, Vertex3D } from './vertex';
import { VpTable } from './vp-table';

export class TriggerItem extends GameItem {

	public static ShapeTriggerNone = 0;
	public static ShapeTriggerWireA = 1;
	public static ShapeTriggerStar = 2;
	public static ShapeTriggerWireB = 3;
	public static ShapeTriggerButton = 4;
	public static ShapeTriggerWireC = 5;
	public static ShapeTriggerWireD = 6;

	public dragPoints: DragPoint[];
	private pdata: number;
	private vCenter: Vertex2D;
	private radius: number;
	private rotation: number;
	private wireThickness: number;
	private scaleX: number;
	private scaleY: number;
	private szMaterial: string;
	private fTimerEnabled: boolean;
	private TimerInterval: number;
	private szSurface: string;
	private fEnabled: boolean;
	private hitHeight: number;
	private fVisible: boolean;
	private fReflectionEnabled: boolean;
	private shape: number;
	private animSpeed: number;
	private wzName: string;

	public static async fromStorage(storage: Storage, itemName: string): Promise<TriggerItem> {
		const triggerItem = new TriggerItem();
		await storage.streamFiltered(itemName, 4, TriggerItem.createStreamHandler(triggerItem));
		return triggerItem;
	}

	public generateMeshes(table: VpTable): Meshes {
		if (this.shape === TriggerItem.ShapeTriggerNone) {
			return {};
		}
		return {
			trigger: this.createMesh(table),
		};
	}

	public getName(): string {
		return this.wzName;
	}

	public isVisible(): boolean {
		return this.fVisible && this.shape !== TriggerItem.ShapeTriggerNone;
	}

	private createMesh(table: VpTable): Mesh {
		const baseHeight = table.getSurfaceHeight(this.szSurface, this.vCenter.x, this.vCenter.y) * table.getScaleZ();

		let zOffset = (this.shape === TriggerItem.ShapeTriggerButton) ? 5.0 : 0.0;
		if (this.shape === TriggerItem.ShapeTriggerWireC) {
			zOffset = -19.0;
		}

		const fullMatrix = new Matrix4();
		if (this.shape === TriggerItem.ShapeTriggerWireB) {
			const tempMatrix = new Matrix4();
			fullMatrix.makeRotationX(M.degToRad(-23.0));
			tempMatrix.makeRotationZ(M.degToRad(this.rotation));
			fullMatrix.multiplyMatrices(fullMatrix, tempMatrix);

		} else if (this.shape === TriggerItem.ShapeTriggerWireC) {
			const tempMatrix = new Matrix4();
			fullMatrix.makeRotationX(M.degToRad(140.0));
			tempMatrix.makeRotationZ(M.degToRad(this.rotation));
			fullMatrix.multiplyMatrices(fullMatrix, tempMatrix);

		} else {
			fullMatrix.makeRotationZ(M.degToRad(this.rotation));
		}

		const mesh = this.getBaseMesh();
		for (const vertex of mesh.vertices) {

			let vert = new Vertex3D(vertex.x, vertex.y, vertex.z);
			vert.applyMatrix4(fullMatrix);

			if (this.shape === TriggerItem.ShapeTriggerButton || this.shape === TriggerItem.ShapeTriggerStar) {
				vertex.x = (vert.x * this.radius) + this.vCenter.x;
				vertex.y = (vert.y * this.radius) + this.vCenter.y;
				vertex.z = (vert.z * this.radius * table.getScaleZ()) + baseHeight + zOffset;
			} else {
				vertex.x = (vert.x * this.scaleX) + this.vCenter.x;
				vertex.y = (vert.y * this.scaleY) + this.vCenter.y;
				vertex.z = (vert.z * table.getScaleZ()) + baseHeight + zOffset;
			}

			vert = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			vert.applyMatrix4(fullMatrix);
			vertex.nx = vert.x;
			vertex.ny = vert.y;
			vertex.nz = vert.z;
		}
		return mesh;
	}

	private getBaseMesh(): Mesh {
		switch (this.shape) {
			case TriggerItem.ShapeTriggerWireA:
			case TriggerItem.ShapeTriggerWireB:
			case TriggerItem.ShapeTriggerWireC:
				return triggerSimpleMesh.clone();
			case TriggerItem.ShapeTriggerWireD:
				return triggerDWireMesh.clone();
			case TriggerItem.ShapeTriggerButton:
				return triggerButtonMesh.clone();
			case TriggerItem.ShapeTriggerStar:
				return triggerStarMesh.clone();
			default:
				logger.warn(null, '[TriggerItem.getBaseMesh] Unknown shape "%s".', this.shape);
				return triggerSimpleMesh.clone();
		}
	}

	private static createStreamHandler(triggerItem: TriggerItem) {
		triggerItem.dragPoints = [];
		return BiffParser.stream(triggerItem.fromTag.bind(triggerItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => triggerItem.dragPoints.push(dragPoint),
				},
			},
		});
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.vCenter = Vertex2D.get(buffer); break;
			case 'RADI': this.radius = this.getFloat(buffer); break;
			case 'ROTA': this.rotation = this.getFloat(buffer); break;
			case 'WITI': this.wireThickness = this.getFloat(buffer); break;
			case 'SCAX': this.scaleX = this.getFloat(buffer); break;
			case 'SCAY': this.scaleY = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'EBLD': this.fEnabled = this.getBool(buffer); break;
			case 'THOT': this.hitHeight = this.getFloat(buffer); break;
			case 'VSBL': this.fVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'SHAP': this.shape = this.getInt(buffer); break;
			case 'ANSP': this.animSpeed = this.getFloat(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
