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

import { values } from 'lodash';
import { Group, Mesh, MeshStandardMaterial, Scene } from 'three';

import { PrimitiveItem } from '../primitive-item';
import { VpTable } from '../vp-table';
import { BaseExporter } from './base-exporter';

const Canvas = require('canvas');
const { Blob, FileReader } = require('vblob');

// Patch global scope to imitate browser environment.
(global as any).window = global;
(global as any).Blob = Blob;
(global as any).FileReader = FileReader;
(global as any).document = {
	createElement: (nodeName: any) => {
		if (nodeName !== 'canvas') {
			throw new Error(`Cannot create node ${nodeName}`);
		}
		const canvas = new Canvas(256, 256);
		// This isn't working — currently need to avoid toBlob(), so export to embedded .gltf not .glb.
		// canvas.toBlob = function () {
		//   return new Blob([this.toBuffer()]);
		// };
		return canvas;
	},
};

export class VpTableExporter extends BaseExporter {

	private readonly table: VpTable;
	private readonly scene: Scene;

	constructor(table: VpTable) {
		super();
		this.table = table;
		this.scene = new Scene();
	}

	public async export(): Promise<object> {
		const tableMesh = new Group();

		let primitive: PrimitiveItem;
		for (primitive of values(this.table.primitives)) {

			const bufferGeometry = primitive.mesh.getBufferGeometry();
			const mesh = new Mesh(bufferGeometry, new MeshStandardMaterial());
			mesh.name = primitive.getName();

			this.positionPrimitive(mesh, primitive);
			tableMesh.add(mesh);
		}

		this.scene.add(tableMesh);

		return await new Promise(resolve => {
			this.gltfExporter.parse(this.scene, resolve, { binary: false });
		});
	}
}
