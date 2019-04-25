/* tslint:disable:variable-name */
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

import { writeFileSync } from 'fs';
import { basename } from 'path';
import { Table } from '../app/vpinball/table';

(async () => {

	try {

		const start = Date.now();
		//const tablePath = 'D:/Pinball/Visual Pinball/Tables/vpdb/e2na558ew.vpx'; // has animation frames
		//const tablePath = 'D:/Pinball/Visual Pinball/Tables/Batman Dark Knight tt&NZ 1.2.vpx';
		//const tablePath = 'D:/Pinball/Visual Pinball/Tables/Materials.vpx';
		//const tablePath = 'C:/Development/vpdb-server/bumpertest.vpx';
		//const tablePath = 'C:/Development/vpdb-server/src/test/fixtures/table-hit-target.vpx';
		const tablePath = 'D:/Pinball/Visual Pinball/Tables/vpdb-production/p2empd85q.vpx';

		const vpt = await Table.load(tablePath);
		const loaded = Date.now();

		// const obj = vpt.gates.find(g => g.getName() === 'WireW');
		// writeFileSync('gate-vpdb.obj', obj.getMeshes(vpt).wire.mesh.serializeToObj());

		const name = basename(tablePath, '.vpx');
		const glb = await vpt.exportGlb({

			applyTextures: true,
			applyMaterials: true,
			exportLightBulbLights: true,
			exportAllLights: false,
			optimizeTextures: true,
			gltfOptions: { compressVertices: true, forcePowerOfTwoTextures: true },

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
		});
		const exported = Date.now();
		writeFileSync(`${name}.glb`, glb);

		console.log('Done! Written %s MB. Load time: %sms, export time: %sms, write time: %sms.',
			Math.round(glb.length / 100000) / 10, loaded - start, exported - loaded, Date.now() - exported);

	} catch (err) {
		console.error(err);

	} finally {
		process.exit();
	}

})();
