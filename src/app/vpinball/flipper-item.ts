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
import { flipperBaseMesh } from './meshes/flipper-base-mesh';
import { Vertex2D, Vertex3D } from './vertex';
import { VpTable } from './vp-table';

/**
 * VPinball's flippers
 *
 * @see https://github.com/vpinball/vpinball/blob/master/flipper.cpp
 */
export class FlipperItem extends GameItem implements IRenderable {

	public wzName: string;
	public pdata: number;
	public Center: Vertex2D;
	public BaseRadius: number = 21.5;
	public EndRadius: number = 13.0;
	public FlipperRadiusMax: number = 130.0;
	public FlipperRadius: number = 130.0;
	public return: number;
	public StartAngle: number = 121.0;
	public EndAngle: number = 70.0;
	public OverridePhysics: number;
	public mass: number;
	public fTimerEnabled: boolean;
	public TimerInterval: number;
	public szSurface: string;
	public szMaterial: string;
	public szRubberMaterial: string;
	public rubberthickness: number = 7.0;
	public rubberheight: number = 19.0;
	public rubberwidth: number = 24.0;
	public height: number = 50.0;
	public strength: number;
	public elasticity: number;
	public elasticityFalloff: number;
	public friction: number;
	public rampUp: number;
	public scatter: number;
	public torqueDamping: number;
	public torqueDampingAngle: number;
	public FlipperRadiusMin: number;
	public fVisible: boolean = true;
	public fEnabled: boolean = true;
	public fReflectionEnabled: boolean = true;
	public szImage: string;

	public static async fromStorage(storage: Storage, itemName: string): Promise<FlipperItem> {
		const flipperItem = new FlipperItem();
		await storage.streamFiltered(itemName, 4, BiffParser.stream(flipperItem.fromTag.bind(flipperItem)));
		return flipperItem;
	}

	public static from(data: any): FlipperItem {
		const flipperItem = new FlipperItem();
		Object.assign(flipperItem, data);
		return flipperItem;
	}

	private constructor() {
		super();
	}

	public isVisible(): boolean {
		return this.fVisible;
	}

	public getName(): string {
		return this.wzName;
	}

	public getMeshes(table: VpTable): Meshes {
		const meshes: Meshes = {};

		const matrix = this.getMatrix();
		const flipper = this.generateMeshes(table);

		// base mesh
		meshes.base = {
			mesh: flipper.base.transform(matrix.toRightHanded()),
			material: table.getMaterial(this.szMaterial),
			map: table.getTexture(this.szImage),
		};

		// rubber mesh
		if (flipper.rubber) {
			meshes.rubber = {
				mesh: flipper.rubber.transform(matrix.toRightHanded()),
				material: table.getMaterial(this.szRubberMaterial),
			};
		}
		return meshes;
	}

	public serialize() {
		return {
			name: this.wzName,
			center: this.Center,
		};
	}

	private getMatrix(): Matrix3D {
		const trafoMatrix = new Matrix3D();
		const tempMatrix = new Matrix3D();
		trafoMatrix.setTranslation(this.Center.x, this.Center.y, 0);
		tempMatrix.rotateZMatrix(M.degToRad(this.StartAngle));
		trafoMatrix.preMultiply(tempMatrix);
		return trafoMatrix;
	}

	private generateMeshes(table: VpTable): { base: Mesh, rubber?: Mesh } {

		const fullMatrix = new Matrix3D();
		fullMatrix.rotateZMatrix(M.degToRad(180.0));

		const height = table.getSurfaceHeight(this.szSurface, this.Center.x, this.Center.y);
		const baseScale = 10.0;
		const tipScale = 10.0;
		const baseRadius = this.BaseRadius - this.rubberthickness;
		const endRadius = this.EndRadius - this.rubberthickness;

		// base and tip
		const baseMesh = flipperBaseMesh.clone(`flipper.base-${this.getName()}`);
		for (let t = 0; t < 13; t++) {
			for (const v of baseMesh.vertices) {
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
		baseMesh.transform(fullMatrix, null, z => z * this.height * table.getScaleZ() + height);

		//rubber
		if (this.rubberthickness > 0.0) {
			const rubberBaseScale = 10.0;
			const rubberTipScale = 10.0;
			const rubberMesh = flipperBaseMesh.clone(`flipper.rubber-${this.getName()}`);
			for (let t = 0; t < 13; t++) {
				for (const v of rubberMesh.vertices) {
					if (v.x === FlipperItem.vertsBaseBottom[t].x && v.y === FlipperItem.vertsBaseBottom[t].y && v.z === FlipperItem.vertsBaseBottom[t].z) {
						v.x *= this.BaseRadius * rubberBaseScale;
						v.y *= this.BaseRadius * rubberBaseScale;
					}
					if (v.x === FlipperItem.vertsTipBottom[t].x && v.y === FlipperItem.vertsTipBottom[t].y && v.z === FlipperItem.vertsTipBottom[t].z) {
						v.x *= this.EndRadius * rubberTipScale;
						v.y *= this.EndRadius * rubberTipScale;
						v.y += this.FlipperRadius - this.EndRadius * 7.9;
					}
					if (v.x === FlipperItem.vertsBaseTop[t].x && v.y === FlipperItem.vertsBaseTop[t].y && v.z === FlipperItem.vertsBaseTop[t].z) {
						v.x *= this.BaseRadius * rubberBaseScale;
						v.y *= this.BaseRadius * rubberBaseScale;
					}
					if (v.x === FlipperItem.vertsTipTop[t].x && v.y === FlipperItem.vertsTipTop[t].y && v.z === FlipperItem.vertsTipTop[t].z) {
						v.x *= this.EndRadius * rubberTipScale;
						v.y *= this.EndRadius * rubberTipScale;
						v.y += this.FlipperRadius - this.EndRadius * 7.9;
					}
				}
			}
			rubberMesh.transform(fullMatrix, null, z => z * this.rubberwidth * table.getScaleZ() + (height + this.rubberheight));
			return { base: baseMesh, rubber: rubberMesh };
		}
		return { base: baseMesh };
	}

	private async fromTag(buffer: Buffer, tag: string, offset: number, len: number): Promise<number> {
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
		return 0;
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
