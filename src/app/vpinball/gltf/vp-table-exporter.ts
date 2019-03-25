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

import { Canvas, Image } from 'canvas';
import { values } from 'lodash';
import {
	Color,
	DoubleSide,
	Group,
	Material as ThreeMaterial,
	Mesh,
	MeshStandardMaterial,
	PointLight,
	RGBAFormat,
	Scene,
	Texture,
	TextureLoader,
} from 'three';
import { BumperItem } from '../bumper-item';
import { FlipperItem } from '../flipper-item';
import { IRenderable, RenderInfo } from '../game-item';
import { PrimitiveItem } from '../primitive-item';
import { RampItem } from '../ramp-item';
import { RubberItem } from '../rubber-item';
import { SurfaceItem } from '../surface-item';
import { VpTable } from '../vp-table';
import { BaseExporter } from './base-exporter';

const { Blob, FileReader } = require('vblob');

// Patch global scope to imitate browser environment.
(global as any).Canvas = Image;
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
		(canvas as any).toBlob = () => new Blob([canvas.toBuffer()]);
		return canvas;
	},
};

export class VpTableExporter extends BaseExporter {

	private static readonly applyMaterials = true;

	private static readonly scale = 0.05;
	private readonly table: VpTable;
	private readonly scene: Scene;
	private playfield: Group;

	protected textureLoader = new TextureLoader();

	constructor(table: VpTable) {
		super();
		this.table = table;
		this.scene = new Scene();
		this.playfield = new Group();
		this.playfield.rotateX(Math.PI / 2);
		//this.playfield.rotateZ(-Math.PI / 2);
		this.playfield.translateY((table.gameData.top - table.gameData.bottom) * VpTableExporter.scale / 2);
		this.playfield.translateX(-(table.gameData.right - table.gameData.left) * VpTableExporter.scale / 2);
		this.playfield.scale.set(VpTableExporter.scale, VpTableExporter.scale, VpTableExporter.scale);
	}

	public async exportGltf(fileId: string): Promise<string> {
		return JSON.stringify(await this.export<any>(fileId, { binary: false }));
	}

	public async exportGlb(fileId: string): Promise<Buffer> {
		return this.arrayBufferToBuffer(await this.export<ArrayBuffer>(fileId, { binary: true }));
	}

	private async export<T>(fileId: string, opts: any = {}): Promise<T> {
		const allRenderables: IRenderable[][] = [
			values<PrimitiveItem>(this.table.primitives),
			values<RubberItem>(this.table.rubbers),
			values<SurfaceItem>(this.table.surfaces),
			values<FlipperItem>(this.table.flippers),
			values<BumperItem>(this.table.bumpers),
			values<RampItem>(this.table.ramps),
			this.table.lights,
			this.table.hitTargets,
			this.table.gates,
			this.table.kickers,
			this.table.triggers,
		];

		// meshes
		for (const renderables of allRenderables) {
			for (const renderable of renderables.filter(i => i.isVisible())) {
				const objects = renderable.getMeshes(this.table);
				let obj: RenderInfo;
				for (obj of values(objects)) {
					const bufferGeometry = obj.mesh.getBufferGeometry();
					const mesh = new Mesh(bufferGeometry, await this.getMaterial(fileId, obj));
					mesh.name = obj.mesh.name;
					if (renderable.getPositionableObject) {
						this.position(mesh, renderable as any);
					}
					this.playfield.add(mesh);
				}
			}
		}

		// lights
		for (const lightInfo of this.table.lights.filter(l => l.showBulbMesh)) {
			const light = new PointLight(lightInfo.color, lightInfo.intensity, lightInfo.falloff * VpTableExporter.scale);
			light.castShadow = false;
			light.position.set(lightInfo.vCenter.x, lightInfo.vCenter.y, -10);
			this.playfield.add(light);
		}

		this.scene.add(this.playfield);

		return await new Promise(resolve => {
			this.gltfExporter.parse(this.scene, resolve, Object.assign({}, opts, { embedImages: true }));
		});
	}

	private async getMaterial(fileId: string, obj: RenderInfo): Promise<ThreeMaterial> {
		const material = new MeshStandardMaterial();
		const materialInfo = obj.material;
		if (materialInfo && VpTableExporter.applyMaterials) {

			material.color = new Color(materialInfo.cBase);
			material.roughness = 1 - materialInfo.fRoughness;
			material.metalness = materialInfo.bIsMetal ? 0.7 : 0.0;
			material.emissive = new Color(materialInfo.cGlossy);
			material.emissiveIntensity = 0.1;

			if (materialInfo.bOpacityActive) {
				material.transparent = true;
				material.opacity = materialInfo.fOpacity;
			}

			material.side = DoubleSide;
		}

		if (obj.map) {
			const img = new Image();
			const doc = await this.table.getDocument();
			//img.src = 'data:image/png;base64' + (await obj.map.getImage(doc.storage('GameStg'))).toString('base64');
			img.src = await obj.map.getImage(doc.storage('GameStg'));
			await doc.close();

			material.map = new Texture();
			material.map.image = img;
			material.map.format = RGBAFormat;
			material.map.needsUpdate = true;
			material.needsUpdate = true;
		}

		// if (obj.map) {
		// 	this.textureLoader.load(obj.map.getUrl(fileId), map => {
		// 		material.map = map;
		// 		material.needsUpdate = true;
		// 	});
		// }

		// if (obj.normalMap) {
		// 	this.textureLoader.load(obj.normalMap.getUrl(fileId), map => {
		// 		map.anisotropy = 16;
		// 		material.normalMap = map;
		// 	});
		// }
		return material;
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
