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
import {
	Color,
	DoubleSide,
	Group,
	Material as ThreeMaterial,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PointLight,
	RGBAFormat,
	RGBFormat,
	Scene,
	Texture,
} from 'three';
import { logger } from '../../common/logger';
import { BumperItem } from '../bumper-item';
import { FlipperItem } from '../flipper-item';
import { IRenderable, RenderInfo } from '../game-item';
import { PrimitiveItem } from '../primitive-item';
import { RampItem } from '../ramp-item';
import { RubberItem } from '../rubber-item';
import { SurfaceItem } from '../surface-item';
import { Texture as VpTexture } from '../texture';
import { VpTable } from '../vp-table';
import { BaseExporter } from './base-exporter';
import { GLTFExporter, ParseOptions } from './gltf-exporter';
import { Image } from './image';

export class VpTableExporter extends BaseExporter {

	private static readonly applyMaterials = true;
	private static readonly applyTextures = true;
	private static readonly optimize = false;

	private static readonly scale = 0.05;
	private readonly table: VpTable;
	private readonly scene: Scene;
	private readonly opts: VpTableExporterOptions;
	private readonly playfield: Group;

	constructor(table: VpTable, opts: VpTableExporterOptions) {
		super();

		this.opts = Object.assign({}, defaultOptions, opts);
		const camera = new PerspectiveCamera(45, 1, 0.1, 100000);
		camera.position.set(0, 70.0, 70.0);
		camera.lookAt(0, -10, 0);

		this.table = table;
		this.scene = new Scene();
		this.playfield = new Group();
		this.playfield.rotateX(Math.PI / 2);
		//this.playfield.rotateZ(-Math.PI / 2);
		this.playfield.translateY((table.gameData.top - table.gameData.bottom) * VpTableExporter.scale / 2);
		this.playfield.translateX(-(table.gameData.right - table.gameData.left) * VpTableExporter.scale / 2);
		this.playfield.scale.set(VpTableExporter.scale, VpTableExporter.scale, VpTableExporter.scale);
	}

	public async exportGltf(): Promise<string> {
		this.opts.gltfOptions.binary = false;
		return JSON.stringify(await this.export<any>());
	}

	public async exportGlb(): Promise<Buffer> {
		this.opts.gltfOptions.binary = true;
		return this.arrayBufferToBuffer(await this.export<ArrayBuffer>());
	}

	private async export<T>(): Promise<T> {
		const renderGroups: IRenderGroup[] = [
			{ name: 'playfield', meshes: [ this.table ], enabled: this.opts.exportPlayfield },
			{ name: 'primitives', meshes: values<PrimitiveItem>(this.table.primitives), enabled: this.opts.exportPrimitives },
			{ name: 'rubbers', meshes: values<RubberItem>(this.table.rubbers), enabled: this.opts.exportRubbers },
			{ name: 'surfaces', meshes: values<SurfaceItem>(this.table.surfaces), enabled: this.opts.exportSurfaces},
			{ name: 'flippers', meshes: values<FlipperItem>(this.table.flippers), enabled: this.opts.exportFlippers},
			{ name: 'bumpers', meshes: values<BumperItem>(this.table.bumpers), enabled: this.opts.exportBumpers },
			{ name: 'ramps', meshes: values<RampItem>(this.table.ramps), enabled: this.opts.exportRamps },
			{ name: 'lightsBulbs', meshes: this.table.lights, enabled: this.opts.exportLightBulbs },
			{ name: 'hitTargets', meshes: this.table.hitTargets, enabled: this.opts.exportHitTargets },
			{ name: 'gates', meshes: this.table.gates, enabled: this.opts.exportGates },
			{ name: 'kickers', meshes: this.table.kickers, enabled: this.opts.exportKickers },
			{ name: 'triggers', meshes: this.table.triggers, enabled: this.opts.exportTriggers },
		];

		// meshes
		for (const group of renderGroups) {
			if (!group.enabled) {
				continue;
			}
			const g = new Group();
			g.name = group.name;
			for (const renderable of group.meshes.filter(i => i.isVisible())) {
				const objects = renderable.getMeshes(this.table);
				let obj: RenderInfo;
				for (obj of values(objects)) {
					const bufferGeometry = obj.mesh.getBufferGeometry();
					const mesh = new Mesh(bufferGeometry, await this.getMaterial(obj));
					mesh.name = obj.mesh.name;
					if (renderable.getPositionableObject) {
						this.position(mesh, renderable as any);
					}
					g.add(mesh);
				}
			}
			if (g.children.length > 0) {
				this.playfield.add(g);
			}
		}

		// lights
		const lightInfos = this.opts.exportAllLights
			? this.table.lights
			: (this.opts.exportLightBulbLights ? this.table.lights.filter(l => l.showBulbMesh) : []);
		for (const lightInfo of lightInfos) {
			const light = new PointLight(lightInfo.color, lightInfo.intensity, lightInfo.falloff * VpTableExporter.scale);
			light.castShadow = false;
			light.position.set(lightInfo.vCenter.x, lightInfo.vCenter.y, -10);
			this.playfield.add(light);
		}

		this.scene.add(this.playfield);

		const gltfExporter = new GLTFExporter(Object.assign({}, this.opts.gltfOptions, { embedImages: true }));
		return gltfExporter.parse(this.scene);
	}

	private async getMaterial(obj: RenderInfo): Promise<ThreeMaterial> {
		const material = new MeshStandardMaterial();
		material.name = `material:${obj.mesh.name}`;
		const materialInfo = obj.material;
		if (materialInfo && VpTableExporter.applyMaterials) {

			material.color = new Color(materialInfo.cBase);
			material.roughness = 1 - materialInfo.fRoughness;
			material.metalness = materialInfo.bIsMetal ? 0.7 : 0.0;
			material.emissive = new Color(materialInfo.cGlossy);
			material.emissiveIntensity = 0.1;

			material.transparent = true;
			if (materialInfo.bOpacityActive) {
				material.opacity = materialInfo.bOpacityActive ? materialInfo.fOpacity : 1;
			}

			material.side = DoubleSide;
		}

		if (VpTableExporter.applyTextures) {
			if (obj.map) {
				material.map = new Texture();
				if (await this.loadMap(obj.mesh.name, obj.map, material.map)) {
					material.needsUpdate = true;
				} else {
					material.map = null;
				}
			}
			if (obj.normalMap) {
				material.normalMap = new Texture();
				if (await this.loadMap(obj.mesh.name, obj.normalMap, material.normalMap)) {
					material.normalMap.anisotropy = 16;
					material.needsUpdate = true;
				} else {
					material.normalMap = null;
				}
			}
		}
		return material;
	}

	private async loadMap(name: string, objMap: VpTexture, materialMap: Texture): Promise<boolean> {
		const doc = await this.table.getDocument();
		let data: Buffer;
		try {
			data = await objMap.getImage(doc.storage('GameStg'));
			if (!data || !data.length) {
				return false;
			}
			const image = await new Image(objMap.isRaw() ? objMap.getRawImage() : data, VpTableExporter.optimize).init();
			materialMap.image = image;
			materialMap.format = image.hasTransparency() ? RGBAFormat : RGBFormat;
			materialMap.needsUpdate = true;
			return true;
		} catch (err) {
			materialMap.image = Texture.DEFAULT_IMAGE;
			logger.warn(null, '[VpTableExporter.getMaterial] Error loading map of %s bytes for %s (%s/%s): %s', data ? data.length : '<null>', name, objMap.storageName, objMap.getName(), err.message);
			return false;
		} finally {
			await doc.close();
		}
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

interface IRenderGroup {
	name: string;
	meshes: IRenderable[];
	enabled: boolean;
}

export interface VpTableExporterOptions {
	applyMaterials?: boolean;
	applyTextures?: boolean;
	optimizeTextures?: boolean;
	exportPlayfield?: boolean;
	exportPrimitives?: boolean;
	exportRubbers?: boolean;
	exportSurfaces?: boolean;
	exportFlippers?: boolean;
	exportBumpers?: boolean;
	exportRamps?: boolean;
	exportLightBulbs?: boolean;
	exportLightBulbLights?: boolean;
	exportAllLights?: boolean;
	exportHitTargets?: boolean;
	exportGates?: boolean;
	exportKickers?: boolean;
	exportTriggers?: boolean;
	gltfOptions?: ParseOptions;
}

const defaultOptions: VpTableExporterOptions = {
	applyMaterials: true,
	applyTextures: true,
	optimizeTextures: false,
	exportPlayfield: true,
	exportPrimitives: true,
	exportRubbers: true,
	exportSurfaces: true,
	exportFlippers: true,
	exportBumpers: true,
	exportRamps: true,
	exportLightBulbs: true,
	exportLightBulbLights: true,
	exportAllLights: false,
	exportHitTargets: true,
	exportGates: true,
	exportKickers: true,
	exportTriggers: true,
	gltfOptions: {},
};
