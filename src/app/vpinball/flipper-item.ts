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
import { GameItem } from './game-item';
import { Mesh } from './mesh';
import { flipperBaseMesh } from './meshes/flipper-base-mesh';
import { Vertex2D, Vertex3D, Vertex3DNoTex2 } from './vertex';
import { VpTable } from './vp-table';

export class FlipperItem extends GameItem {

	public wzName: string;
	public pdata: number;
	public Center: Vertex2D;
	public BaseRadius: number;
	public EndRadius: number;
	public FlipperRadiusMax: number;
	public FlipperRadius: number;
	public return: number;
	public StartAngle: number;
	public EndAngle: number;
	public OverridePhysics: number;
	public mass: number;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public szSurface: string;
	public szMaterial: string;
	public szRubberMaterial: string;
	public rubberthickness: number;
	public rubberheight: number;
	public rubberwidth: number;
	public height: number;
	public strength: number;
	public elasticity: number;
	public elasticityFalloff: number;
	public friction: number;
	public rampUp: number;
	public scatter: number;
	public torqueDamping: number;
	public torqueDampingAngle: number;
	public FlipperRadiusMin: number;
	public fVisible: boolean;
	public fEnabled: boolean;
	public fReflectionEnabled: boolean;
	public szImage: string;

	public static async fromStorage(storage: Storage, itemName: string): Promise<FlipperItem> {
		const flipperItem = new FlipperItem();
		await storage.streamFiltered(itemName, 4, FlipperItem.createStreamHandler(flipperItem));
		return flipperItem;
	}

	public static from(data: any): FlipperItem {
		const flipperItem = new FlipperItem();
		Object.assign(flipperItem, data);
		return flipperItem;
	}

	private static createStreamHandler(lightItem: FlipperItem) {
		return BiffParser.stream(lightItem.fromTag.bind(lightItem));
	}

	private constructor() {
		super();
	}

	public getName(): string {
		return this.wzName;
	}

	public serialize() {
		return {
			name: this.wzName,
			center: this.Center,
		};
	}

	public generateMeshes(table: VpTable): { base: Mesh, rubber?: Mesh } {


		const matTrafo = new Matrix4();
		const matTemp = new Matrix4();
		matTrafo.identity();
		matTemp.identity();
		matTrafo.makeTranslation(this.Center.x, this.Center.y, 0);
		matTemp.makeRotationZ(M.radToDeg(this.StartAngle));
		matTrafo.multiplyMatrices(matTrafo, matTemp);

		const flipper = this.generateBaseMesh(table);

		let buf = flipper.base;
		for (let i = 0; i < flipperBaseMesh.vertices.length; i++) {
			let vert = new Vertex3D(buf[i].x, buf[i].y, buf[i].z);
			vert.applyMatrix4(matTrafo);
			buf[i].x = vert.x;
			buf[i].y = vert.y;
			buf[i].z = vert.z;

			vert = new Vertex3D(buf[i].nx, buf[i].ny, buf[i].nz);
			vert.applyMatrix4(matTemp);
			buf[i].nx = vert.x;
			buf[i].ny = vert.y;
			buf[i].nz = vert.z;
		}

		const baseMesh = new Mesh();
		baseMesh.name = 'Base';
		baseMesh.vertices = buf;
		baseMesh.indices = flipperBaseMesh.indices;

		const meshes: { base: Mesh, rubber?: Mesh } = {
			base: baseMesh
		};

		if (this.rubberthickness > 0.0) {

			buf = flipper.rubber;
			for (let i = 0; i < flipperBaseMesh.vertices.length; i++) {
				let vert = new Vertex3D(buf[i].x, buf[i].y, buf[i].z);
				vert.applyMatrix4(matTrafo);
				buf[i].x = vert.x;
				buf[i].y = vert.y;
				buf[i].z = vert.z;

				vert = new Vertex3D(buf[i].nx, buf[i].ny, buf[i].nz);
				vert.applyMatrix4(matTemp);
				buf[i].nx = vert.x;
				buf[i].ny = vert.y;
				buf[i].nz = vert.z;
			}

			const rubberMesh = new Mesh();
			rubberMesh.name = 'Rubber';
			rubberMesh.vertices = buf;
			rubberMesh.indices = flipperBaseMesh.indices;
			rubberMesh.faceIndexOffset = flipperBaseMesh.vertices.length;

			meshes.rubber = rubberMesh;
		}

		return meshes;
	}

	private generateBaseMesh(table: VpTable): { base: Vertex3DNoTex2[], rubber: Vertex3DNoTex2[] } {

		const result: { base: Vertex3DNoTex2[], rubber: Vertex3DNoTex2[] } = {
			base: [],
			rubber: [],
		};
		const fullMatrix = new Matrix4();
		//fullMatrix.makeRotationZ(M.degToRad(180.0));

		const height = table.getSurfaceHeight(this.szSurface, this.Center.x, this.Center.y);
		const baseScale = 10.0;
		const tipScale = 10.0;
		const baseRadius = this.BaseRadius - this.rubberthickness;
		const endRadius = this.EndRadius - this.rubberthickness;

		let temp = flipperBaseMesh.clone().vertices;

		// scale the base and tip
		for (let t = 0; t < 13; t++) {
			for (const v of temp) {
				if (v.x === FlipperItem.vertsBaseBottom[t].x && v.y === FlipperItem.vertsBaseBottom[t].y && v.z === FlipperItem.vertsBaseBottom[t].z) {
					v.x *= baseRadius * baseScale;
					v.y *= baseRadius * baseScale;
				}
				if (v.x === FlipperItem.vertsTipBottom[t].x && v.y === FlipperItem.vertsTipBottom[t].y && v.z === FlipperItem.vertsTipBottom[t].z) {
					v.x *= endRadius * tipScale;
					v.y *= endRadius * tipScale;
					v.y += this.FlipperRadius - endRadius * 7.9;
				}
				if (v.x === FlipperItem.vertsBaseTop[t].x && v.y === FlipperItem.vertsBaseTop[t].y && v.z === FlipperItem.vertsBaseTop[t].z) {
					v.x *= baseRadius * baseScale;
					v.y *= baseRadius * baseScale;
				}
				if (v.x === FlipperItem.vertsTipTop[t].x && v.y === FlipperItem.vertsTipTop[t].y && v.z === FlipperItem.vertsTipTop[t].z) {
					v.x *= endRadius * tipScale;
					v.y *= endRadius * tipScale;
					v.y += this.FlipperRadius - endRadius * 7.9;
				}
			}
		}
		for (let i = 0; i < flipperBaseMesh.vertices.length; i++) {

			let vert = new Vertex3D(temp[i].x, temp[i].y, temp[i].z);
			vert.applyMatrix4(fullMatrix);
			result.base[i] = new Vertex3DNoTex2();
			result.base[i].x = vert.x;
			result.base[i].y = vert.y;
			result.base[i].z = vert.z * this.height * table.getScaleZ() + height;

			vert = new Vertex3D(flipperBaseMesh.vertices[i].nx, flipperBaseMesh.vertices[i].ny, flipperBaseMesh.vertices[i].nz);
			vert.applyMatrix4(fullMatrix);
			result.base[i].nx = vert.x;
			result.base[i].ny = vert.y;
			result.base[i].nz = vert.z;
			result.base[i].tu = flipperBaseMesh.vertices[i].tu;
			result.base[i].tv = flipperBaseMesh.vertices[i].tv;
		}

		//rubber
		if (this.rubberthickness > 0.0) {
			const rubberBaseScale = 10.0;
			const rubberTipScale = 10.0;
			temp = flipperBaseMesh.clone().vertices;
			for (let t = 0; t < 13; t++) {
				for (let i = 0; i < flipperBaseMesh.vertices.length; i++) {
					if (temp[i].x === FlipperItem.vertsBaseBottom[t].x && temp[i].y === FlipperItem.vertsBaseBottom[t].y && temp[i].z === FlipperItem.vertsBaseBottom[t].z) {
						temp[i].x *= this.BaseRadius * rubberBaseScale;
						temp[i].y *= this.BaseRadius * rubberBaseScale;
					}
					if (temp[i].x === FlipperItem.vertsTipBottom[t].x && temp[i].y === FlipperItem.vertsTipBottom[t].y && temp[i].z === FlipperItem.vertsTipBottom[t].z) {
						temp[i].x *= this.EndRadius * rubberTipScale;
						temp[i].y *= this.EndRadius * rubberTipScale;
						temp[i].y += this.FlipperRadius - this.EndRadius * 7.9;
					}
					if (temp[i].x === FlipperItem.vertsBaseTop[t].x && temp[i].y === FlipperItem.vertsBaseTop[t].y && temp[i].z === FlipperItem.vertsBaseTop[t].z) {
						temp[i].x *= this.BaseRadius * rubberBaseScale;
						temp[i].y *= this.BaseRadius * rubberBaseScale;
					}
					if (temp[i].x === FlipperItem.vertsTipTop[t].x && temp[i].y === FlipperItem.vertsTipTop[t].y && temp[i].z === FlipperItem.vertsTipTop[t].z) {
						temp[i].x *= this.EndRadius * rubberTipScale;
						temp[i].y *= this.EndRadius * rubberTipScale;
						temp[i].y += this.FlipperRadius - this.EndRadius * 7.9;
					}
				}
			}

			for (let i = 0; i < flipperBaseMesh.vertices.length; i++) {
				let vert = new Vertex3D(temp[i].x, temp[i].y, temp[i].z);
				vert.applyMatrix4(fullMatrix);
				result.rubber[i] = new Vertex3DNoTex2();
				result.rubber[i].x = vert.x;
				result.rubber[i].y = vert.y;
				result.rubber[i].z = vert.z * this.rubberwidth * table.getScaleZ() + (height + this.rubberheight);

				vert = new Vertex3D(flipperBaseMesh.vertices[i].nx, flipperBaseMesh.vertices[i].ny, flipperBaseMesh.vertices[i].nz);
				vert.applyMatrix4(fullMatrix);
				result.rubber[i].nx = vert.x;
				result.rubber[i].ny = vert.y;
				result.rubber[i].nz = vert.z;
				result.rubber[i].tu = flipperBaseMesh.vertices[i].tu;
				result.rubber[i].tv = flipperBaseMesh.vertices[i].tv + 0.5;
			}
		}
		return result;
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<void> {
		switch (tag) {
			case 'PIID': this.pdata = this.getInt(buffer); break;
			case 'VCEN': this.Center = Vertex2D.get(buffer); break;
			case 'BASR': this.BaseRadius = this.getFloat(buffer); break;
			case 'ENDR': this.EndRadius = this.getFloat(buffer); break;
			case 'FLPR':
				this.FlipperRadiusMax = this.getFloat(buffer);
				this.FlipperRadius = this.FlipperRadiusMax;
				break;
			case 'FRTN': this.return = this.getFloat(buffer); break;
			case 'ANGS': this.StartAngle = this.getFloat(buffer); break;
			case 'ANGE': this.EndAngle = this.getFloat(buffer); break;
			case 'OVRP': this.OverridePhysics = this.getInt(buffer); break;
			case 'FORC': this.mass = this.getFloat(buffer); break;
			case 'TMON': this.fTimerEnabled = this.getBool(buffer); break;
			case 'TMIN': this.TimerInterval = this.getInt(buffer); break;
			case 'SURF': this.szSurface = this.getString(buffer, len); break;
			case 'MATR': this.szMaterial = this.getString(buffer, len); break;
			case 'RUMA': this.szRubberMaterial = this.getString(buffer, len); break;
			case 'NAME': this.wzName = this.getWideString(buffer, len); break;
			case 'RTHK': this.rubberthickness = this.getInt(buffer); break;
			case 'RTHF': this.rubberthickness = this.getFloat(buffer); break;
			case 'RHGT': this.rubberheight = this.getInt(buffer); break;
			case 'RHGF': this.rubberheight = this.getFloat(buffer); break;
			case 'RWDT': this.rubberwidth = this.getInt(buffer); break;
			case 'RWDF': this.rubberwidth = this.getFloat(buffer); break;
			case 'FHGT': this.height = this.getFloat(buffer); break;
			case 'STRG': this.strength = this.getFloat(buffer); break;
			case 'ELAS': this.elasticity = this.getFloat(buffer); break;
			case 'ELFO': this.elasticityFalloff = this.getFloat(buffer); break;
			case 'FRIC': this.friction = this.getFloat(buffer); break;
			case 'RPUP': this.rampUp = this.getFloat(buffer); break;
			case 'SCTR': this.scatter = this.getFloat(buffer); break;
			case 'TODA': this.torqueDamping = this.getFloat(buffer); break;
			case 'TDAA': this.torqueDampingAngle = this.getFloat(buffer); break;
			case 'FRMN': this.FlipperRadiusMin = this.getFloat(buffer); break;
			case 'VSBL': this.fVisible = this.getBool(buffer); break;
			case 'ENBL': this.fEnabled = this.getBool(buffer); break;
			case 'REEN': this.fReflectionEnabled = this.getBool(buffer); break;
			case 'IMAG': this.szImage = this.getString(buffer, len); break;
			default:
				this.getUnknownBlock(buffer, tag);
				break;
		}
	}

	private static vertsTipBottom = [
		new Vertex3D(-0.101425, 0.786319, 0.003753),
		new Vertex3D(-0.097969, 0.812569, 0.003753),
		new Vertex3D(-0.087837, 0.837031, 0.003753),
		new Vertex3D(-0.071718, 0.858037, 0.003753),
		new Vertex3D(-0.050713, 0.874155, 0.003753),
		new Vertex3D(-0.026251, 0.884288, 0.003753),
		new Vertex3D(-0.000000, 0.887744, 0.003753),
		new Vertex3D(0.026251, 0.884288, 0.003753),
		new Vertex3D(0.050713, 0.874155, 0.003753),
		new Vertex3D(0.071718, 0.858037, 0.003753),
		new Vertex3D(0.087837, 0.837031, 0.003753),
		new Vertex3D(0.097969, 0.812569, 0.003753),
		new Vertex3D(0.101425, 0.786319, 0.003753),
	];

	private static vertsTipTop = [
		new Vertex3D(-0.101425, 0.786319, 1.004253),
		new Vertex3D(-0.097969, 0.812569, 1.004253),
		new Vertex3D(-0.087837, 0.837031, 1.004253),
		new Vertex3D(-0.071718, 0.858037, 1.004253),
		new Vertex3D(-0.050713, 0.874155, 1.004253),
		new Vertex3D(-0.026251, 0.884288, 1.004253),
		new Vertex3D(-0.000000, 0.887744, 1.004253),
		new Vertex3D(0.026251, 0.884288, 1.004253),
		new Vertex3D(0.050713, 0.874155, 1.004253),
		new Vertex3D(0.071718, 0.858037, 1.004253),
		new Vertex3D(0.087837, 0.837031, 1.004253),
		new Vertex3D(0.097969, 0.812569, 1.004253),
		new Vertex3D(0.101425, 0.786319, 1.004253),
	];

	private static vertsBaseBottom = [
		new Vertex3D(-0.100762, -0.000000, 0.003753),
		new Vertex3D(-0.097329, -0.026079, 0.003753),
		new Vertex3D(-0.087263, -0.050381, 0.003753),
		new Vertex3D(-0.071250, -0.071250, 0.003753),
		new Vertex3D(-0.050381, -0.087263, 0.003753),
		new Vertex3D(-0.026079, -0.097329, 0.003753),
		new Vertex3D(-0.000000, -0.100762, 0.003753),
		new Vertex3D(0.026079, -0.097329, 0.003753),
		new Vertex3D(0.050381, -0.087263, 0.003753),
		new Vertex3D(0.071250, -0.071250, 0.003753),
		new Vertex3D(0.087263, -0.050381, 0.003753),
		new Vertex3D(0.097329, -0.026079, 0.003753),
		new Vertex3D(0.100762, -0.000000, 0.003753),
	];

	private static vertsBaseTop = [
		new Vertex3D(-0.100762, 0.000000, 1.004253),
		new Vertex3D(-0.097329, -0.026079, 1.004253),
		new Vertex3D(-0.087263, -0.050381, 1.004253),
		new Vertex3D(-0.071250, -0.071250, 1.004253),
		new Vertex3D(-0.050381, -0.087263, 1.004253),
		new Vertex3D(-0.026079, -0.097329, 1.004253),
		new Vertex3D(-0.000000, -0.100762, 1.004253),
		new Vertex3D(0.026079, -0.097329, 1.004253),
		new Vertex3D(0.050381, -0.087263, 1.004253),
		new Vertex3D(0.071250, -0.071250, 1.004253),
		new Vertex3D(0.087263, -0.050381, 1.004253),
		new Vertex3D(0.097329, -0.026079, 1.004253),
		new Vertex3D(0.100762, -0.000000, 1.004253),
	];

}
