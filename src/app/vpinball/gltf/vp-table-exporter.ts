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
import { SurfaceItem } from '../surface-item';
import { RubberItem } from '../rubber-item';

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

	private static readonly scale = 0.05;
	private readonly table: VpTable;
	private readonly scene: Scene;
	private playfield: Group;

	constructor(table: VpTable) {
		super();
		this.table = table;
		this.scene = new Scene();
		this.playfield = new Group();
		this.playfield.rotateX(Math.PI / 2);
		this.playfield.rotateZ(-Math.PI / 2);
		this.playfield.translateY((table.gameData.top - table.gameData.bottom) * VpTableExporter.scale / 2);
		this.playfield.translateX(-(table.gameData.right - table.gameData.left) * VpTableExporter.scale / 2);
		this.playfield.scale.set(VpTableExporter.scale, VpTableExporter.scale, VpTableExporter.scale);
	}

	public async export(): Promise<object> {

		let primitive: PrimitiveItem;
		for (primitive of values(this.table.primitives)) {

			const bufferGeometry = primitive.mesh.getBufferGeometry();
			const mesh = new Mesh(bufferGeometry, new MeshStandardMaterial());
			mesh.name = 'primitive:' + primitive.getName();

			this.positionPrimitive(mesh, primitive);
			this.playfield.add(mesh);
		}

		let rubber: RubberItem;
		for (rubber of values(this.table.rubbers).filter(r => r.fVisible)) {
			const bufferGeometry = rubber.generateMesh(this.table.gameData.tableheight).getBufferGeometry();
			const mesh = new Mesh(bufferGeometry, new MeshStandardMaterial());
			mesh.name = 'rubber:' + primitive.getName();
			this.playfield.add(mesh);
		}

		// let surface: SurfaceItem;
		// for (surface of values(this.table.surfaces)) {
		// 	const meshes = surface.generateMeshes(this.table);
		//
		// 	const topMesh = new Mesh(meshes.top.getBufferGeometry(), new MeshStandardMaterial());
		// 	const sideMesh = new Mesh(meshes.side.getBufferGeometry(), new MeshStandardMaterial());
		// 	topMesh.name = 'surface-top:' + surface.getName();
		// 	sideMesh.name = 'surface-side:' + surface.getName();
		//
		// 	this.playfield.add(topMesh);
		// 	this.playfield.add(sideMesh);
		// }

		this.scene.add(this.playfield);

		return await new Promise(resolve => {
			this.gltfExporter.parse(this.scene, resolve, { binary: false });
		});
	}
}
