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

import { Math as M, Object3D } from 'three';
import { OBJLoader } from './lib/OBJLoader';

import { IPositionable } from '../mesh';
import { GLTFExporter } from './gltf-exporter';

export abstract class BaseExporter {

	protected objLoader: any = new OBJLoader();
	protected gltfExporter = new GLTFExporter();

	protected position(mesh: Object3D, obj: IPositionable) {

		const trans = obj.getTransition();
		const pos = obj.getPosition();
		const rot = obj.getRotation();
		const objRot = obj.getObjectRotation();
		const scale = obj.getScale();

		mesh.scale.set(scale.x, scale.y, scale.z);
		mesh.translateX(trans.x + pos.x);
		mesh.translateY(trans.y + pos.y);
		mesh.translateZ(-trans.z - pos.z);

		mesh.rotateY(M.degToRad(-objRot.x));
		mesh.rotateX(M.degToRad(objRot.y));
		mesh.rotateZ(M.degToRad(objRot.z));

		mesh.rotateX(M.degToRad(-rot.x));
		mesh.rotateY(M.degToRad(-rot.y));
		mesh.rotateZ(M.degToRad(rot.z));
	}

}
