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

import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { DragPoint } from './dragpoint';
import { GameItem } from './game-item';
import { Mesh } from './mesh';
import { RenderVertex, Vertex2D, Vertex3DNoTex2 } from './vertex';
import { VpTable } from './vp-table';

export class SurfaceItem extends GameItem {

	public pdata: number;
	public fHitEvent: boolean;
	public fDroppable: boolean;
	public fFlipbook: boolean;
	public fIsBottomSolid: boolean;
	public fCollidable: boolean;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public threshold: number;
	public szImage: string;
	public szSideImage: string;
	public szSideMaterial: string;
	public szTopMaterial: string;
	public szPhysicsMaterial: string;
	public szSlingShotMaterial: string;
	public heightbottom: number;
	public heighttop: number;
	public fInner: boolean;
	public wzName: string;
	public fDisplayTexture: boolean;
	public slingshotforce: number;
	public slingshotThreshold: number;
	public elasticity: number;
	public friction: number;
	public scatter: number;
	public fTopBottomVisible: boolean;
	public fOverwritePhysics: boolean;
	public fSlingshotAnimation: boolean;
	public fDisableLightingTop: number;
	public fDisableLightingBelow: number;
	public fSideVisible: boolean;
	public fReflectionEnabled: boolean;
	public dragPoints: DragPoint[];

	public static async fromStorage(storage: Storage, itemName: string): Promise<SurfaceItem> {
		const surfaceItem = new SurfaceItem();
		await storage.streamFiltered(itemName, 4, SurfaceItem.createStreamHandler(surfaceItem));
		return surfaceItem;
	}

	public static from(data: any): SurfaceItem {
		const surfaceItem = new SurfaceItem();
		Object.assign(surfaceItem, data);
		return surfaceItem;
	}

	private static createStreamHandler(surfaceItem: SurfaceItem) {
		surfaceItem.dragPoints = [];
		return BiffParser.stream(surfaceItem.fromTag.bind(surfaceItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => surfaceItem.dragPoints.push(dragPoint),
				},
			},
		});
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public serialize() {
		return {};
	}

	public generateMeshes(table: VpTable): { top: Mesh, side: Mesh } {
		const meshes: { top: Mesh, side: Mesh } = {
			top: new Mesh(),
			side: new Mesh(),
		};

		meshes.top.name = this.getName() + ' Top';
		meshes.side.name = this.getName() + ' Side';

		const vvertex: RenderVertex[] = DragPoint.getRgVertex(this.dragPoints);
		let rgtexcoord: number[] = null;

		const pinSide = this.szSideImage;
		//if (pinSide) {
			rgtexcoord = DragPoint.getTextureCoords(this.dragPoints, vvertex);
		//}

		const numVertices = vvertex.length;
		const rgnormal: Vertex2D[] = [];

		for (let i = 0; i < numVertices; i++) {

			const pv1 = vvertex[i];
			const pv2 = vvertex[(i < numVertices - 1) ? (i + 1) : 0];
			const dx = pv1.x - pv2.x;
			const dy = pv1.y - pv2.y;

			const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy);

			rgnormal[i] = new Vertex2D();
			rgnormal[i].x = dy * invLen;
			rgnormal[i].y = dx * invLen;
		}

		const bottom = this.heightbottom + table.gameData.tableheight;
		const top = this.heighttop + table.gameData.tableheight;

		let offset = 0;
		// Render side
		for (let i = 0; i < numVertices; i++) {

			const pv1 = vvertex[i];
			const pv2 = vvertex[(i < numVertices - 1) ? (i + 1) : 0];

			const a = (i === 0) ? (numVertices - 1) : (i - 1);
			const c = (i < numVertices - 1) ? (i + 1) : 0;

			const vnormal = [new Vertex2D(), new Vertex2D()];
			if (pv1.fSmooth) {
				vnormal[0].x = (rgnormal[a].x + rgnormal[i].x) * 0.5;
				vnormal[0].y = (rgnormal[a].y + rgnormal[i].y) * 0.5;
			} else {
				vnormal[0].x = rgnormal[i].x;
				vnormal[0].y = rgnormal[i].y;
			}

			if (pv2.fSmooth) {
				vnormal[1].x = (rgnormal[i].x + rgnormal[c].x) * 0.5;
				vnormal[1].y = (rgnormal[i].y + rgnormal[c].y) * 0.5;
			} else {
				vnormal[1].x = rgnormal[i].x;
				vnormal[1].y = rgnormal[i].y;
			}

			vnormal[0].normalize();
			vnormal[1].normalize();

			meshes.side.vertices[offset] = new Vertex3DNoTex2();
			meshes.side.vertices[offset + 1] = new Vertex3DNoTex2();
			meshes.side.vertices[offset + 2] = new Vertex3DNoTex2();
			meshes.side.vertices[offset + 3] = new Vertex3DNoTex2();

			meshes.side.vertices[offset].x = pv1.x;
			meshes.side.vertices[offset].y = pv1.y;
			meshes.side.vertices[offset].z = bottom;
			meshes.side.vertices[offset + 1].x = pv1.x;
			meshes.side.vertices[offset + 1].y = pv1.y;
			meshes.side.vertices[offset + 1].z = top;
			meshes.side.vertices[offset + 2].x = pv2.x;
			meshes.side.vertices[offset + 2].y = pv2.y;
			meshes.side.vertices[offset + 2].z = top;
			meshes.side.vertices[offset + 3].x = pv2.x;
			meshes.side.vertices[offset + 3].y = pv2.y;
			meshes.side.vertices[offset + 3].z = bottom;

			//if (pinSide) {
				meshes.side.vertices[offset].tu = rgtexcoord[i];
				meshes.side.vertices[offset].tv = 1.0;

				meshes.side.vertices[offset + 1].tu = rgtexcoord[i];
				meshes.side.vertices[offset + 1].tv = 0;

				meshes.side.vertices[offset + 2].tu = rgtexcoord[c];
				meshes.side.vertices[offset + 2].tv = 0;

				meshes.side.vertices[offset + 3].tu = rgtexcoord[c];
				meshes.side.vertices[offset + 3].tv = 1.0;
			//}

			meshes.side.vertices[offset].nx = vnormal[0].x;
			meshes.side.vertices[offset].ny = -vnormal[0].y;
			meshes.side.vertices[offset].nz = 0;

			meshes.side.vertices[offset + 1].nx = vnormal[0].x;
			meshes.side.vertices[offset + 1].ny = -vnormal[0].y;
			meshes.side.vertices[offset + 1].nz = 0;

			meshes.side.vertices[offset + 2].nx = vnormal[1].x;
			meshes.side.vertices[offset + 2].ny = -vnormal[1].y;
			meshes.side.vertices[offset + 2].nz = 0;

			meshes.side.vertices[offset + 3].nx = vnormal[1].x;
			meshes.side.vertices[offset + 3].ny = -vnormal[1].y;
			meshes.side.vertices[offset + 3].nz = 0;

			offset += 4;
		}

		// prepare index buffer for sides
		let offset2 = 0;
		for (let i = 0; i < numVertices; i++) {
			meshes.side.indices[i * 6] = offset2;
			meshes.side.indices[i * 6 + 1] = offset2 + 1;
			meshes.side.indices[i * 6 + 2] = offset2 + 2;
			meshes.side.indices[i * 6 + 3] = offset2;
			meshes.side.indices[i * 6 + 4] = offset2 + 2;
			meshes.side.indices[i * 6 + 5] = offset2 + 3;

			offset2 += 4;
		}

		// draw top
		const vpoly: number[] = [];
		for (let i = 0; i < numVertices; i++) {
			vpoly[i] = i;
		}

		meshes.top.indices = Mesh.polygonToTriangles(vvertex, vpoly);

		const numPolys = meshes.top.indices.length / 3;
		if (numPolys === 0) {
			// no polys to render leave vertex buffer undefined
			return;
		}

		const heightNotDropped = this.heighttop;
		const heightDropped = this.heightbottom + 0.1;

		const invTablewidth = 1.0 / (table.gameData.right - table.gameData.left);
		const invTableheight = 1.0 / (table.gameData.bottom - table.gameData.top);

		const vertsTop: Vertex3DNoTex2[][] = [[], [], []];
		for (let i = 0; i < numVertices; i++) {

			const pv0 = vvertex[i];

			vertsTop[0][i] = new Vertex3DNoTex2();
			vertsTop[0][i].x = pv0.x;
			vertsTop[0][i].y = pv0.y;
			vertsTop[0][i].z = heightNotDropped + table.gameData.tableheight;
			vertsTop[0][i].tu = pv0.x * invTablewidth;
			vertsTop[0][i].tv = pv0.y * invTableheight;
			vertsTop[0][i].nx = 0;
			vertsTop[0][i].ny = 0;
			vertsTop[0][i].nz = 1.0;

			vertsTop[1][i] = new Vertex3DNoTex2();
			vertsTop[1][i].x = pv0.x;
			vertsTop[1][i].y = pv0.y;
			vertsTop[1][i].z = heightDropped;
			vertsTop[1][i].tu = pv0.x * invTablewidth;
			vertsTop[1][i].tv = pv0.y * invTableheight;
			vertsTop[1][i].nx = 0;
			vertsTop[1][i].ny = 0;
			vertsTop[1][i].nz = 1.0;

			vertsTop[2][i] = new Vertex3DNoTex2();
			vertsTop[2][i].x = pv0.x;
			vertsTop[2][i].y = pv0.y;
			vertsTop[2][i].z = this.heightbottom;
			vertsTop[2][i].tu = pv0.x * invTablewidth;
			vertsTop[2][i].tv = pv0.y * invTableheight;
			vertsTop[2][i].nx = 0;
			vertsTop[2][i].ny = 0;
			vertsTop[2][i].nz = -1.0;
		}
		meshes.top.vertices = [...vertsTop[0], ...vertsTop[1], ...vertsTop[2]];

		return meshes;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'HTEV': this.fHitEvent = this.getBool(buffer); break;
			case 'DROP': this.fDroppable = this.getBool(buffer); break;
			case 'FLIP': this.fFlipbook = this.getBool(buffer); break;
			case 'ISBS': this.fIsBottomSolid = this.getBool(buffer); break;
			case 'CLDW': this.fCollidable = this.getBool(buffer); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'THRS': this.threshold = this.getFloat(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			case 'SIMG': this.szSideImage = this.getString(buffer, len); break;
			case 'SIMA': this.szSideMaterial = this.getString(buffer, len, true); break;
			case 'TOMA': this.szTopMaterial = this.getString(buffer, len, true); break;
			case 'MAPH': this.szPhysicsMaterial = this.getString(buffer, len); break;
			case 'SLMA': this.szSlingShotMaterial = this.getString(buffer, len, true); break;
			case 'HTBT': this.heightbottom = this.getFloat(buffer); break;
			case 'HTTP': this.heighttop = this.getFloat(buffer); break;
			case 'INNR': this.fInner = this.getBool(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'DSPT': this.fDisplayTexture = this.getBool(buffer); break;
			case 'SLGF': this.slingshotforce = this.getFloat(buffer);break;
			case 'SLTH': this.slingshotThreshold = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'WFCT': this.friction = this.getFloat(buffer); break;
			case 'WSCT': this.scatter = this.getFloat(buffer); break;
			case 'VSBL': this.fTopBottomVisible = this.getBool(buffer); break;
			case 'OVPH': this.fOverwritePhysics = this.getBool(buffer); break;
			case 'SLGA': this.fSlingshotAnimation = this.getBool(buffer); break;
			case 'DILI': this.fDisableLightingTop = this.getFloat(buffer); break;
			case 'DILB': this.fDisableLightingBelow = this.getFloat(buffer); break;
			case 'SVBL': this.fSideVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'PNTS': break; // never read in vpinball
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}
}
