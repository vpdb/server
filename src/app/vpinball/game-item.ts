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

import { Matrix4 } from 'three';
import { Storage } from '../common/ole-doc';
import { BiffParser } from './biff-parser';
import { Material } from './material';
import { Matrix3D } from './matrix3d';
import { Mesh } from './mesh';
import { Texture } from './texture';
import { Vertex3D } from './vertex';
import { VpTable } from './vp-table';

export abstract class GameItem extends BiffParser {

	public static TypeSurface = 0;
	public static TypeFlipper = 1;
	public static TypeTimer = 2;
	public static TypePlunger = 3;
	public static TypeTextbox = 4;
	public static TypeBumper = 5;
	public static TypeTrigger = 6;
	public static TypeLight = 7;
	public static TypeKicker = 8;
	public static TypeDecal = 9;
	public static TypeGate = 10;
	public static TypeSpinner = 11;
	public static TypeRamp = 12;
	public static TypeTable = 13;
	public static TypeLightCenter = 14;
	public static TypeDragPoint = 15;
	public static TypeCollection = 16;
	public static TypeDispReel = 17;
	public static TypeLightSeq = 18;
	public static TypePrimitive = 19;
	public static TypeFlasher = 20;
	public static TypeRubber = 21;
	public static TypeHitTarget = 22;
	public static TypeCount = 23;
	public static TypeInvalid = 0xffffffff;

	public static getType(type: number): string {
		switch (type) {
			case GameItem.TypeSurface: return 'Surface';
			case GameItem.TypeFlipper: return 'Flipper';
			case GameItem.TypeTimer: return 'Timer';
			case GameItem.TypePlunger: return 'Plunger';
			case GameItem.TypeTextbox: return 'Textbox';
			case GameItem.TypeBumper: return 'Bumper';
			case GameItem.TypeTrigger: return 'Trigger';
			case GameItem.TypeLight: return 'Light';
			case GameItem.TypeKicker: return 'Kicker';
			case GameItem.TypeDecal: return 'Decal';
			case GameItem.TypeGate: return 'Gate';
			case GameItem.TypeSpinner: return 'Spinner';
			case GameItem.TypeRamp: return 'Ramp';
			case GameItem.TypeTable: return 'Table';
			case GameItem.TypeLightCenter: return 'Light Center';
			case GameItem.TypeDragPoint: return 'Drag Point';
			case GameItem.TypeCollection: return 'Collection';
			case GameItem.TypeDispReel: return 'Reel';
			case GameItem.TypeLightSeq: return 'Light Sequence';
			case GameItem.TypePrimitive: return 'Primitive';
			case GameItem.TypeFlasher: return 'Flasher';
			case GameItem.TypeRubber: return 'Rubber';
			case GameItem.TypeHitTarget: return 'Hit Target';
			case GameItem.TypeCount: return 'Count';
			case GameItem.TypeInvalid: return 'Invalid';
		}
	}

	public fLocked: boolean;
	public layerIndex: number;

	public abstract getName(): string;

	protected async getData(storage: Storage, itemName: string, offset: number, len: number): Promise<Buffer> {
		return storage.read(itemName, offset, len);
	}

	protected getUnknownBlock(buffer: Buffer, tag: string) {
		switch (tag) {
			case 'LOCK': this.fLocked = this.getBool(buffer); break;
			case 'LAYR': this.layerIndex = this.getInt(buffer); break;
			default:
				//logger.warn(null, '[GameItem.parseUnknownBlock]: Unknown block "%s".', tag);
				break;
		}
	}

	protected applyTransformation(mesh: Mesh, matrix: Matrix4, normalMatrix?: Matrix4, getZ?: (x: number) => number): Mesh {
		for (const vertex of mesh.vertices) {
			const vert = new Vertex3D(vertex.x, vertex.y, vertex.z);
			vert.applyMatrix4(matrix);
			vertex.x = vert.x;
			vertex.y = vert.y;
			vertex.z = getZ ? getZ(vert.z) : vert.z;

			const norm = new Vertex3D(vertex.nx, vertex.ny, vertex.nz);
			norm.applyMatrix4NoTranslate(normalMatrix || matrix);
			vertex.nx = norm.x;
			vertex.ny = norm.y;
			vertex.nz = norm.z;
		}
		return mesh;
	}

	protected leftHandedToRightHanded(matrix: Matrix3D): Matrix3D {
		const tempMat = new Matrix3D();
		tempMat.setScaling(1, 1, -1);
		matrix.multiply(tempMat);
		return matrix;
	}
}

export interface IRenderable {
	getMeshes(table: VpTable): Meshes;
	isVisible(): boolean;
}

export interface Meshes {
	[key: string]: RenderInfo;
}

export interface RenderInfo {
	mesh: Mesh;
	map?: Texture;
	normalMap?: Texture;
	material?: Material;
}
