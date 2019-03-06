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

import { VpTable } from '../app/vpinball/vp-table';

(async () => {

	try {

		const tablePath = 'D:/Pinball/Visual Pinball/Tables/Batman Dark Knight tt&NZ 1.2.vpx';
		const outPath2 = 'compressed.bin';
		const outPath = 'test.obj';
		const item = 'GameItem201';
		const tag = 'M3CX';

		const vpt = await VpTable.load(tablePath);

		await vpt.getPrimitive('Joker').exportMeshToObj('Joker.obj');

	} catch (err) {
		console.error(err);
	}

})();
