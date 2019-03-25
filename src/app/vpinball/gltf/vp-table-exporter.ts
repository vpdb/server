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
import { VpTable } from '../vp-table';
import { BaseExporter } from './base-exporter';
import { IRenderable, RenderInfo } from '../game-item';

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

	public async exportGltf(): Promise<string> {
		return JSON.stringify(await this.export<any>({ binary: false }));
	}

	public async exportGlb(): Promise<Buffer> {
		return this.arrayBufferToBuffer(await this.export<ArrayBuffer>({ binary: true }));
	}

	private async export<T>(opts: any = {}): Promise<T> {
		const allRenderables: IRenderable[][] = [
			values(this.table.primitives),
			values(this.table.rubbers),
			values(this.table.surfaces),
			values(this.table.flippers),
			values(this.table.bumpers),
			values(this.table.ramps),
			this.table.lights,
			this.table.hitTargets,
			this.table.gates,
			this.table.kickers,
			this.table.triggers,
		];

		for (const renderables of allRenderables) {
			for (const renderable of renderables.filter(i => i.isVisible())) {
				const objects = renderable.getMeshes(this.table);
				let obj: RenderInfo;
				for (obj of values(objects)) {
					const bufferGeometry = obj.mesh.getBufferGeometry();
					const mesh = new Mesh(bufferGeometry, new MeshStandardMaterial());
					mesh.name = obj.mesh.name;

					if (renderable.getPositionableObject) {
						this.position(mesh, renderable as any);
					}
					this.playfield.add(mesh);
				}
			}
		}

		this.scene.add(this.playfield);

		return await new Promise(resolve => {
			this.gltfExporter.parse(this.scene, resolve, opts);
		});
	}

	private arrayBufferToBuffer(ab: ArrayBuffer) {
		const buffer = new Buffer(ab.byteLength);
		const view = new Uint8Array(ab);
		for (let i = 0; i < buffer.length; ++i) {
			buffer[i] = view[i];
		}
		return buffer;
	}
}
