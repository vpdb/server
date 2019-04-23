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

const expect = require('expect.js');
const ApiClient = require('../../test/api.client');
const ThreeHelper = require('../../test/three.helper');

const api = new ApiClient();
const three = new ThreeHelper(api);

const tableWidth = 1111;
const tableHeight = 2222;

describe('The VPinball table generator', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
		});
	});

	after(async () => await api.teardown());

	it('should generate the correct playfield mesh', async () => {
		const vpxFile = await api.fileHelper.createVpx('member', 'table-empty.vpx');
		const gltf = await three.loadGlb('member', vpxFile.variations.gltf);
		const playfieldMesh = three.first(gltf, 'playfield');
		const playfieldVertices = playfieldMesh.geometry.attributes.position;
		const expectedVertices = [ tableWidth, tableHeight, 0, tableWidth, 0, 0, 0, 0, 0, 0, tableHeight, 0, tableWidth, tableHeight, 0, 0, 0, 0 ];
		expect(compareArray(playfieldVertices.array, expectedVertices)).to.be(true);
	});
});

function compareArray(arr1, arr2) {
	if (arr1.length !== arr2.length) {
		return false;
	}
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) {
			return false;
		}
	}
	return true;
}