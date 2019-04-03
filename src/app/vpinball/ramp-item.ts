/* tslint:disable */
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
import { GameItem, IRenderable, Meshes } from './game-item';
import { Mesh } from './mesh';
import { RenderVertex3D, Vertex2D, Vertex3D, Vertex3DNoTex2 } from './vertex';
import { VpTable } from './vp-table';
import { Matrix3D } from './matrix3d';

/**
 * VPinball's ramps.
 *
 * @see https://github.com/vpinball/vpinball/blob/master/ramp.cpp
 */
export class RampItem extends GameItem implements IRenderable {

	public static RampTypeFlat = 0;
	public static RampType4Wire = 1;
	public static RampType2Wire = 2;
	public static RampType3WireLeft = 3;
	public static RampType3WireRight = 4;
	public static RampType1Wire = 5;

	public static RampImageAlignmentWorld = 0;
	public static RampImageAlignmentWrap = 1;

	public wzName: string;
	public dragPoints: DragPoint[];
	public pdata: number;
	public heightbottom: number;
	public heighttop: number;
	public widthbottom: number;
	public widthtop: number;
	public szMaterial: string;
	public fTimerEnabled: number;
	public TimerInterval: number;
	public rampType: number;
	public szImage: string;
	public imagealignment: number;
	public fImageWalls: boolean;
	public leftwallheight: number;
	public rightwallheight: number;
	public leftwallheightvisible: number;
	public rightwallheightvisible: number;
	public fHitEvent: boolean;
	public threshold: number;
	public elasticity: number;
	public friction: number;
	public scatter: number;
	public fCollidable: boolean;
	public fVisible: boolean;
	public fReflectionEnabled: boolean;
	public depthBias: number;
	public wireDiameter: number;
	public wireDistanceX: number;
	public wireDistanceY: number;
	public szPhysicsMaterial: string;
	public fOverwritePhysics: boolean;

	public static async fromStorage(storage: Storage, itemName: string): Promise<RampItem> {
		const rampItem = new RampItem();
		await storage.streamFiltered(itemName, 4, RampItem.createStreamHandler(rampItem));
		return rampItem;
	}

	public static from(data: any): RampItem {
		const rampItem = new RampItem();
		Object.assign(rampItem, data);
		return rampItem;
	}

	private static createStreamHandler(rampItem: RampItem) {
		rampItem.dragPoints = [];
		return BiffParser.stream(rampItem.fromTag.bind(rampItem), {
			nestedTags: {
				DPNT: {
					onStart: () => new DragPoint(),
					onTag: dragPoint => dragPoint.fromTag.bind(dragPoint),
					onEnd: dragPoint => rampItem.dragPoints.push(dragPoint),
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

	public isVisible(): boolean {
		return this.fVisible;
	}

	public getMeshes(table: VpTable): Meshes {
		const meshes: Meshes = {};
		if (!this.isHabitrail()) {
			const flatMeshes = this.generateFlatMesh(table);
			for (const mesh of flatMeshes) {
				meshes[mesh.name] = {
					mesh: mesh.transform(new Matrix3D().toRightHanded()),
					map: table.getTexture(this.szImage),
					material: table.getMaterial(this.szMaterial),
				};
			}
		} else {
			const [wireMeshA, wireMeshB] = this.generateWireMeshes(table);
			switch (this.rampType) {
				case RampItem.RampType1Wire: {
					meshes.wire1 = {
						mesh: wireMeshA.transform(new Matrix3D().toRightHanded()),
						map: table.getTexture(this.szImage),
						material: table.getMaterial(this.szMaterial),
					};
					break;
				}
				case RampItem.RampType2Wire: {
					const wire1Mesh = wireMeshA.makeTranslation(0, 0, 3.0);
					const wire2Mesh = wireMeshB.makeTranslation(0, 0, 3.0);
					wire1Mesh.name = `ramp:wire1:${this.getName()}`;
					wire2Mesh.name = `ramp:wire2:${this.getName()}`;
					meshes.wire1 = {
						mesh: wire1Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire2 = {
						mesh: wire2Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					break;
				}
				case RampItem.RampType4Wire: {
					const wire1Mesh = wireMeshA.clone(`ramp:wire1:${this.getName()}`).makeTranslation(0, 0, this.wireDistanceY*0.5);
					const wire2Mesh = wireMeshB.clone(`ramp:wire2:${this.getName()}`).makeTranslation(0, 0, this.wireDistanceY*0.5);
					const wire3Mesh = wireMeshA.makeTranslation(0, 0, 3.0);
					const wire4Mesh = wireMeshB.makeTranslation(0, 0, 3.0);
					wire3Mesh.name = `ramp:wire3:${this.getName()}`;
					wire4Mesh.name = `ramp:wire4:${this.getName()}`;
					meshes.wire1 = {
						mesh: wire1Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire2 = {
						mesh: wire2Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire3 = {
						mesh: wire3Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire4 = {
						mesh: wire4Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					break;
				}
				case RampItem.RampType3WireLeft: {
					const wire2Mesh = wireMeshB.clone(`ramp:wire2:${this.getName()}`).makeTranslation(0, 0, this.wireDistanceY*0.5);
					const wire3Mesh = wireMeshA.makeTranslation(0, 0, 3.0);
					const wire4Mesh = wireMeshB.makeTranslation(0, 0, 3.0);
					wire3Mesh.name = `ramp:wire3:${this.getName()}`;
					wire4Mesh.name = `ramp:wire4:${this.getName()}`;
					meshes.wire2 = {
						mesh: wire2Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire3 = {
						mesh: wire3Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire4 = {
						mesh: wire4Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					break;
				}
				case RampItem.RampType3WireRight: {
					const wire1Mesh = wireMeshA.clone(`ramp:wire1:${this.getName()}`).makeTranslation(0, 0, this.wireDistanceY*0.5);
					const wire3Mesh = wireMeshA.makeTranslation(0, 0, 3.0);
					const wire4Mesh = wireMeshB.makeTranslation(0, 0, 3.0);
					wire3Mesh.name = `ramp:wire3:${this.getName()}`;
					wire4Mesh.name = `ramp:wire4:${this.getName()}`;
					meshes.wire1 = {
						mesh: wire1Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire3 = {
						mesh: wire3Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					meshes.wire4 = {
						mesh: wire4Mesh.transform(new Matrix3D().toRightHanded()),
						material: table.getMaterial(this.szMaterial),
					};
					break;
				}
			}
		}
		return meshes;
	}

	public getSurfaceHeight() {
		return 0; // FIXME
	}

	private generateFlatMesh(table: VpTable): Mesh[] {

		const meshes: Mesh[] = [];
		const rv = this.getRampVertex(table, -1, true);
		const rampVertex = rv.pcvertex;
		const rgheight = rv.ppheight;
		const rgratio = rv.ppratio;

		const inv_tablewidth = 1.0 / (table.gameData.right - table.gameData.left);
		const inv_tableheight = 1.0 / (table.gameData.bottom - table.gameData.top);

		const numVertices = rampVertex * 2;

		const floorMesh = new Mesh();
		floorMesh.name = `ramp:floor:${this.getName()}`;
		for (let i = 0; i < rampVertex; i++) {

			const rgv3d1 = new Vertex3DNoTex2();
			const rgv3d2 = new Vertex3DNoTex2();

			rgv3d1.x = rv.rgvLocal[i].x;
			rgv3d1.y = rv.rgvLocal[i].y;
			rgv3d1.z = rgheight[i] * table.getScaleZ();

			rgv3d2.x = rv.rgvLocal[rampVertex * 2 - i - 1].x;
			rgv3d2.y = rv.rgvLocal[rampVertex * 2 - i - 1].y;
			rgv3d2.z = rgv3d1.z;

			if (this.szImage) {
				if (this.imagealignment == RampItem.RampImageAlignmentWorld) {
					rgv3d1.tu = rgv3d1.x * inv_tablewidth;
					rgv3d1.tv = rgv3d1.y * inv_tableheight;
					rgv3d2.tu = rgv3d2.x * inv_tablewidth;
					rgv3d2.tv = rgv3d2.y * inv_tableheight;

				} else {
					rgv3d1.tu = 1.0;
					rgv3d1.tv = rgratio[i];
					rgv3d2.tu = 0.0;
					rgv3d2.tv = rgratio[i];
				}

			} else {
				rgv3d1.tu = 0.0;
				rgv3d1.tv = 0.0;
				rgv3d2.tu = 0.0;
				rgv3d2.tv = 0.0;
			}

			floorMesh.vertices.push(rgv3d1);
			floorMesh.vertices.push(rgv3d2);

			if (i == rampVertex - 1) {
				break;
			}

			floorMesh.indices.push(i * 2);
			floorMesh.indices.push(i * 2 + 1);
			floorMesh.indices.push(i * 2 + 3);
			floorMesh.indices.push(i * 2);
			floorMesh.indices.push(i * 2 + 3);
			floorMesh.indices.push(i * 2 + 2);
		}

		Mesh.computeNormals(floorMesh.vertices, numVertices, floorMesh.indices, (rampVertex - 1) * 6);
		meshes.push(floorMesh);

		if (this.leftwallheightvisible !== 0.0) {
			const leftMesh = new Mesh();
			leftMesh.name = `ramp:left:${this.getName()}`;
			for (let i = 0; i < rampVertex; i++) {

				const rgv3d1 = new Vertex3DNoTex2();
				const rgv3d2 = new Vertex3DNoTex2();

				rgv3d1.x = rv.rgvLocal[i].x;
				rgv3d1.y = rv.rgvLocal[i].y;
				rgv3d1.z = rgheight[i] * table.getScaleZ();

				rgv3d2.x = rv.rgvLocal[i].x;
				rgv3d2.y = rv.rgvLocal[i].y;
				rgv3d2.z = (rgheight[i] + this.rightwallheightvisible) * table.getScaleZ();

				if (this.szImage && this.fImageWalls) {
					if (this.imagealignment == RampItem.RampImageAlignmentWorld) {
						rgv3d1.tu = rgv3d1.x * inv_tablewidth;
						rgv3d1.tv = rgv3d1.y * inv_tableheight;

					} else {
						rgv3d1.tu = 0;
						rgv3d1.tv = rgratio[i];
					}
					rgv3d2.tu = rgv3d1.tu;
					rgv3d2.tv = rgv3d1.tv;
				} else {
					rgv3d1.tu = 0.0;
					rgv3d1.tv = 0.0;
					rgv3d2.tu = 0.0;
					rgv3d2.tv = 0.0;
				}

				leftMesh.vertices.push(rgv3d1);
				leftMesh.vertices.push(rgv3d2);

				if (i == rampVertex - 1) {
					break;
				}

				leftMesh.indices.push(i * 2);
				leftMesh.indices.push(i * 2 + 1);
				leftMesh.indices.push(i * 2 + 3);
				leftMesh.indices.push(i * 2);
				leftMesh.indices.push(i * 2 + 3);
				leftMesh.indices.push(i * 2 + 2);

			}
			Mesh.computeNormals(leftMesh.vertices, numVertices, leftMesh.indices, (rampVertex - 1) * 6);
			meshes.push(leftMesh);
		}

		if (this.rightwallheightvisible !== 0.0) {
			const rightMesh = new Mesh();
			rightMesh.name = `ramp:right:${this.getName()}`;
			for (let i = 0; i < rampVertex; i++) {

				const rgv3d1 = new Vertex3DNoTex2();
				const rgv3d2 = new Vertex3DNoTex2();

				rgv3d1.x = rv.rgvLocal[rampVertex * 2 - i - 1].x;
				rgv3d1.y = rv.rgvLocal[rampVertex * 2 - i - 1].y;
				rgv3d1.z = rgheight[i] * table.getScaleZ();

				rgv3d2.x = rgv3d1.x;
				rgv3d2.y = rgv3d1.y;
				rgv3d2.z = (rgheight[i] + this.leftwallheightvisible) * table.getScaleZ();

				if (this.szImage && this.fImageWalls) {
					if (this.imagealignment == RampItem.RampImageAlignmentWorld) {
						rgv3d1.tu = rgv3d1.x * inv_tablewidth;
						rgv3d1.tv = rgv3d1.y * inv_tableheight;
					} else {
						rgv3d1.tu = 0;
						rgv3d1.tv = rgratio[i];
					}

					rgv3d2.tu = rgv3d1.tu;
					rgv3d2.tv = rgv3d1.tv;
				} else {
					rgv3d1.tu = 0.0;
					rgv3d1.tv = 0.0;
					rgv3d2.tu = 0.0;
					rgv3d2.tv = 0.0;
				}

				rightMesh.vertices.push(rgv3d1);
				rightMesh.vertices.push(rgv3d2);

				if (i == rampVertex - 1) {
					break;
				}

				rightMesh.indices.push(i * 2);
				rightMesh.indices.push(i * 2 + 1);
				rightMesh.indices.push(i * 2 + 3);
				rightMesh.indices.push(i * 2);
				rightMesh.indices.push(i * 2 + 3);
				rightMesh.indices.push(i * 2 + 2);
			}
			Mesh.computeNormals(rightMesh.vertices, numVertices, rightMesh.indices, (rampVertex - 1) * 6);
			meshes.push(rightMesh);
		}
		return meshes;
	}

	private generateWireMeshes(table: VpTable): Mesh[] {
		const meshes: Mesh[] = [];

		let accuracy;
		if (table.getDetailLevel() < 5) {
			accuracy = 6;
		} else if (table.getDetailLevel() >= 5 && table.getDetailLevel() < 8) {
			accuracy = 8;
		} else {
			accuracy = Math.floor(table.getDetailLevel() * 1.3); // see below
		}

		// as solid ramps are rendered into the static buffer, always use maximum precision
		const mat = table.getMaterial(this.szMaterial);
		if (!mat || !mat.bOpacityActive) {
			accuracy = Math.floor(10.0 * 1.3); // see above
		}

		const rv = this.getRampVertex(table, -1, false);
		const splinePoints = rv.pcvertex;
		const rgheightInit = rv.ppheight;
		const middlePoints = rv.pMiddlePoints;

		const numRings = splinePoints;
		const numSegments = accuracy;

		const tmpPoints: Vertex2D[] = [];

		for (let i = 0; i < splinePoints; i++) {
			tmpPoints[i] = rv.rgvLocal[splinePoints * 2 - i - 1];
		}

		let vertBuffer: Vertex3DNoTex2[] = [];
		let vertBuffer2: Vertex3DNoTex2[] = [];

		if (this.rampType != RampItem.RampType1Wire)
		{
			vertBuffer = this.createWire(numRings, numSegments, rv.rgvLocal, rgheightInit);
			vertBuffer2 = this.createWire(numRings, numSegments, tmpPoints, rgheightInit);
		} else {
			vertBuffer = this.createWire(numRings, numSegments, middlePoints, rgheightInit);
		}

		// calculate faces
		const indices: number[] = [];
		for (let i = 0; i < numRings - 1; i++) {
			for (let j = 0; j < numSegments; j++) {
				const quad: number[] = [];
				quad[0] = i * numSegments + j;

				if (j != numSegments - 1) {
					quad[1] = i * numSegments + j + 1;
				} else {
					quad[1] = i * numSegments;
				}

				if (i != numRings - 1) {
					quad[2] = (i + 1) * numSegments + j;
					if (j != numSegments - 1) {
						quad[3] = (i + 1) * numSegments + j + 1;
					} else {
						quad[3] = (i + 1) * numSegments;
					}
				} else {
					quad[2] = j;
					if (j != numSegments - 1) {
						quad[3] = j + 1;
					} else {
						quad[3] = 0;
					}
				}

				const offs = (i * numSegments + j) * 6;
				indices[offs] = quad[0];
				indices[offs + 1] = quad[1];
				indices[offs + 2] = quad[2];
				indices[offs + 3] = quad[3];
				indices[offs + 4] = quad[2];
				indices[offs + 5] = quad[1];
			}
		}

		meshes.push(new Mesh(vertBuffer, indices));

		if (this.rampType != RampItem.RampType1Wire) {
			meshes.push(new Mesh(vertBuffer2, indices));
		}

		return meshes;
	}

	private createWire(numRings: number, numSegments: number, midPoints: Vertex2D[], rgheightInit: number[]): Vertex3DNoTex2[] {
		const rgvbuf: Vertex3DNoTex2[] = [];
		let prevB: Vertex3D = new Vertex3D();
		let index = 0;
		for (let i = 0; i < numRings; i++) {

			const i2 = (i == (numRings - 1)) ? i : i + 1;
			const height = rgheightInit[i];

			const tangent = new Vertex3D(midPoints[i2].x - midPoints[i].x, midPoints[i2].y - midPoints[i].y, rgheightInit[i2] - rgheightInit[i]);
			if (i == numRings - 1) {
				// for the last spline point use the previous tangent again, otherwise we won't see the complete wire (it stops one control point too early)
				tangent.x = midPoints[i].x - midPoints[i - 1].x;
				tangent.y = midPoints[i].y - midPoints[i - 1].y;
			}
			let binorm: Vertex3D;
			let normal: Vertex3D;
			if (i == 0) {
				const up = new Vertex3D(midPoints[i2].x + midPoints[i].x, midPoints[i2].y + midPoints[i].y, rgheightInit[i2] - height);
				normal = tangent.clone().cross(up);     //normal
				binorm = tangent.clone().cross(normal);
			} else {
				normal = prevB.clone().cross(tangent);
				binorm = tangent.clone().cross(normal);
			}
			binorm.normalize();
			normal.normalize();
			prevB = binorm;

			const inv_numRings = 1.0 / numRings;
			const inv_numSegments = 1.0 / numSegments;
			const u = i * inv_numRings;
			for (let j = 0; j < numSegments; j++, index++) {
				const v = (j + u) * inv_numSegments;
				const tmp: Vertex3D = Vertex3D.getRotatedAxis(j * (360.0 * inv_numSegments), tangent, normal).multiplyScalar(this.wireDiameter * 0.5);
				rgvbuf[index] = new Vertex3DNoTex2();
				rgvbuf[index].x = midPoints[i].x + tmp.x;
				rgvbuf[index].y = midPoints[i].y + tmp.y;
				rgvbuf[index].z = height + tmp.z;
				//texel
				rgvbuf[index].tu = u;
				rgvbuf[index].tv = v;
				const n = new Vertex3D(rgvbuf[index].x - midPoints[i].x, rgvbuf[index].y - midPoints[i].y, rgvbuf[index].z - height);
				const len = 1.0 / Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
				rgvbuf[index].nx = n.x * len;
				rgvbuf[index].ny = n.y * len;
				rgvbuf[index].nz = n.z * len;
			}
		}
		return rgvbuf;
	}

	private getRampVertex(table: VpTable, _accuracy: number, inc_width: boolean): RampVertexResult {

		const ppheight: number[] = [];
		const ppfCross: boolean[] = [];
		const ppratio: number[] = [];
		const pMiddlePoints: Vertex2D[] = [];

		// vvertex are the 2D vertices forming the central curve of the ramp as seen from above
		const vvertex = this.getCentralCurve(table, _accuracy);

		const cvertex = vvertex.length;
		const pcvertex = cvertex;
		const rgvLocal: Vertex2D[] = [];

		// Compute an approximation to the length of the central curve
		// by adding up the lengths of the line segments.
		let totallength = 0;
		const bottomHeight = this.heightbottom + table.gameData.tableheight;
		const topHeight = this.heighttop + table.gameData.tableheight;

		for (let i = 0; i < (cvertex - 1); i++) {

			const v1 = vvertex[i];
			const v2 = vvertex[i + 1];

			const dx = v1.x - v2.x;
			const dy = v1.y - v2.y;
			const length = Math.sqrt(dx * dx + dy * dy);

			totallength += length;
		}

		let currentlength = 0;
		for (let i = 0; i < cvertex; i++) {

			// clamp next and prev as ramps do not loop
			const vprev = vvertex[(i > 0) ? i - 1 : i];
			const vnext = vvertex[(i < (cvertex - 1)) ? i + 1 : i];
			const vmiddle = vvertex[i];

			ppfCross[i] = vmiddle.fControlPoint;

			let vnormal = new Vertex2D();
			// Get normal at this point
			// Notice that these values equal the ones in the line
			// equation and could probably be substituted by them.
			const v1normal = new Vertex2D(vprev.y - vmiddle.y, vmiddle.x - vprev.x);   // vector vmiddle-vprev rotated RIGHT
			const v2normal = new Vertex2D(vmiddle.y - vnext.y, vnext.x - vmiddle.x);   // vector vnext-vmiddle rotated RIGHT

			// special handling for beginning and end of the ramp, as ramps do not loop
			if (i == (cvertex - 1)) {
				v1normal.normalize();
				vnormal = v1normal;

			} else if (i == 0) {
				v2normal.normalize();
				vnormal = v2normal;

			} else {
				v1normal.normalize();
				v2normal.normalize();

				if (Math.abs(v1normal.x - v2normal.x) < 0.0001 && Math.abs(v1normal.y - v2normal.y) < 0.0001) {
					// Two parallel segments
					vnormal = v1normal;

				} else {
					// Find intersection of the two edges meeting this points, but
					// shift those lines outwards along their normals

					// First line
					const A = vprev.y - vmiddle.y;
					const B = vmiddle.x - vprev.x;

					// Shift line along the normal
					const C = -(A * (vprev.x - v1normal.x) + B * (vprev.y - v1normal.y));

					// Second line
					const D = vnext.y - vmiddle.y;
					const E = vmiddle.x - vnext.x;

					// Shift line along the normal
					const F = -(D * (vnext.x - v2normal.x) + E * (vnext.y - v2normal.y));

					const det = A * E - B * D;
					const inv_det = (det != 0.0) ? 1.0 / det : 0.0;

					const intersectx = (B * F - E * C) * inv_det;
					const intersecty = (C * D - A * F) * inv_det;

					vnormal.x = vmiddle.x - intersectx;
					vnormal.y = vmiddle.y - intersecty;
				}
			}

			// Update current length along the ramp.
			const dx = vprev.x - vmiddle.x;
			const dy = vprev.y - vmiddle.y;
			const length = Math.sqrt(dx * dx + dy * dy);

			currentlength += length;

			const percentage = currentlength / totallength;
			let widthcur = percentage * (this.widthtop - this.widthbottom) + this.widthbottom;
			ppheight[i] = vmiddle.z + percentage * (topHeight - bottomHeight) + bottomHeight;

			this.assignHeightToControlPoint(vvertex[i], vmiddle.z + percentage * (topHeight - bottomHeight) + bottomHeight);
			ppratio[i] = 1.0 - percentage;

			// only change the width if we want to create vertices for rendering or for the editor
			// the collision engine uses flat type ramps
			if (this.isHabitrail() && this.rampType != RampItem.RampType1Wire) {
				widthcur = this.wireDistanceX;
				if (inc_width) {
					widthcur += 20.0;
				}
			} else if (this.rampType == RampItem.RampType1Wire) {
				widthcur = this.wireDiameter;
			}

			pMiddlePoints[i] = new Vertex2D(vmiddle.x, vmiddle.y).add(vnormal);
			rgvLocal[i] = new Vertex2D(vmiddle.x, vmiddle.y).add(vnormal.clone().multiplyScalar(widthcur * 0.5));
			rgvLocal[cvertex * 2 - i - 1] = new Vertex2D(vmiddle.x, vmiddle.y).sub(vnormal.clone().multiplyScalar(widthcur * 0.5));
		}

		return { rgvLocal, pcvertex, ppheight, ppfCross, ppratio, pMiddlePoints };
	}

	private getCentralCurve(table: VpTable, acc: number = -1.0): RenderVertex3D[] {
		let accuracy: number;

		// as solid ramps are rendered into the static buffer, always use maximum precision
		if (acc !== -1.0) {
			accuracy = acc; // used for hit shape calculation, always!
		} else {
			const mat = table.getMaterial(this.szMaterial);
			if (!mat || !mat.bOpacityActive) {
				accuracy = 10.0;
			} else {
				accuracy = table.getDetailLevel();
			}
		}
		accuracy = 4.0 * Math.pow(10.0, (10.0 - accuracy) * (1.0 / 1.5)); // min = 4 (highest accuracy/detail level), max = 4 * 10^(10/1.5) = ~18.000.000 (lowest accuracy/detail level)
		return DragPoint.getRgVertex<RenderVertex3D>(this.dragPoints, () => new RenderVertex3D(), false, accuracy);
	}

	private isHabitrail(): boolean {
		return this.rampType === RampItem.RampType4Wire
			|| this.rampType === RampItem.RampType1Wire
			|| this.rampType === RampItem.RampType2Wire
			|| this.rampType === RampItem.RampType3WireLeft
			|| this.rampType === RampItem.RampType3WireRight;
	}

	private assignHeightToControlPoint(v: RenderVertex3D, height: number) {
		for (const dragPoint of this.dragPoints) {
			if (dragPoint.vertex.x === v.x && dragPoint.vertex.y === v.y) {
				dragPoint.calcHeight = height;
			}
		}
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'HTBT': this.heightbottom = this.getFloat(buffer); break;
			case 'HTTP': this.heighttop = this.getFloat(buffer); break;
			case 'WDBT': this.widthbottom = this.getFloat(buffer); break;
			case 'WDTP': this.widthtop = this.getFloat(buffer); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'TMON': this.fTimerEnabled = this.getInt(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'TYPE': this.rampType = this.getInt(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			case 'ALGN': this.imagealignment = this.getInt(buffer); break;
			case 'IMGW': this.fImageWalls = this.getBool(buffer); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'WLHL': this.leftwallheight = this.getFloat(buffer); break;
			case 'WLHR': this.rightwallheight = this.getFloat(buffer); break;
			case 'WVHL': this.leftwallheightvisible = this.getFloat(buffer); break;
			case 'WVHR': this.rightwallheightvisible = this.getFloat(buffer); break;
			case 'HTEV': this.fHitEvent = this.getBool(buffer); break;
			case 'THRS': this.threshold = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'RFCT': this.friction = this.getFloat(buffer); break;
			case 'RSCT': this.scatter = this.getFloat(buffer); break;
			case 'CLDR': this.fCollidable = this.getBool(buffer); break;
			case 'RVIS': this.fVisible = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'RADB': this.depthBias = this.getFloat(buffer); break;
			case 'RADI': this.wireDiameter = this.getFloat(buffer); break;
			case 'RADX': this.wireDistanceX = this.getFloat(buffer); break;
			case 'RADY': this.wireDistanceY = this.getFloat(buffer); break;
			case 'MAPH': this.szPhysicsMaterial = this.getString(buffer, len); break;
			case 'OVPH': this.fOverwritePhysics = this.getBool(buffer); break;
			case 'PNTS': break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
		return 0;
	}
}

interface RampVertexResult {
	pcvertex: number;
	ppheight: number[];
	ppfCross: boolean[];
	ppratio: number[];
	pMiddlePoints: Vertex2D[];
	rgvLocal: Vertex2D[];
}