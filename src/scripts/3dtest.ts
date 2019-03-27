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
import { VpTable } from '../app/vpinball/vp-table';

(async () => {

	try {

		const start = Date.now();
		//const tablePath = 'D:/Pinball/Visual Pinball/Tables/Medieval Madness Reloaded 1.0.vpx';
		//const tablePath = 'C:/Development/vpdb-server/data/storage-protected/pk45rodfw.vpx';
		const tablePath = 'D:/Pinball/Visual Pinball/Tables/Batman Dark Knight tt&NZ 1.2.vpx';

		const vpt = await VpTable.load(tablePath);
		const loaded = Date.now();

		const name = basename(tablePath, '.vpx');
		//writeFileSync(`${name}.gltf`, await vpt.exportGltf();
		const glb = await vpt.exportGlb();
		const exported = Date.now();
		writeFileSync(`${name}.glb`, glb);
		//writeFileSync(`${name}.json`, JSON.stringify(vpt, null, '  '));

		console.log('Done! Written %s MB. Load time: %sms, export time: %sms, write time: %sms.',
			Math.round(glb.length / 100000) / 10, loaded - start, exported - loaded, Date.now() - exported);

	} catch (err) {
		console.error(err);

	} finally {
		process.exit();
	}

})();
