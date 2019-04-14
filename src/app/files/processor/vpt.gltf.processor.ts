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

import { RequestState } from '../../common/typings/context';
import { Table } from '../../vpinball/table';
import { FileDocument } from '../file.document';
import { FileUtil } from '../file.util';
import { FileVariation } from '../file.variations';
import { CreationProcessor } from './processor';

export class VptGltfProcessor implements CreationProcessor<FileVariation> {

	public name: string = 'vpt.gltf';

	public canProcess(file: FileDocument, srcVariation: FileVariation, destVariation: FileVariation): boolean {
		return file.getMimeCategory() === 'table';
	}

	public getOrder(variation?: FileVariation): number {
		return 0;
	}

	public async process(requestState: RequestState, file: FileDocument, src: string, dest: string, variation?: FileVariation): Promise<string> {

		const vpt = await Table.load(src);
		const glb = await vpt.exportGlb({

			// texture and material
			applyTextures: true,
			applyMaterials: true,
			optimizeTextures: true,
			gltfOptions: { compressVertices: process.env.NODE_ENV !== 'test', forcePowerOfTwoTextures: true }, // dont compress in tests

			// lights
			exportLightBulbLights: true,
			exportAllLights: false,

			// meshes
			exportPrimitives: true,
			exportTriggers: true,
			exportKickers: true,
			exportGates: true,
			exportHitTargets: true,
			exportFlippers: true,
			exportBumpers: true,
			exportRamps: true,
			exportSurfaces: true,
			exportRubbers: true,
			exportLightBulbs: true,
			exportPlayfield: true,
			exportSpinners: true,
		});
		await FileUtil.writeFile(dest, glb);
		return dest;
	}
}
