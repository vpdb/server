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

const ApiClient = require('../../test/api.client');
const ThreeHelper = require('../../test/three.helper');

const api = new ApiClient();
const three = new ThreeHelper(api);

describe('The VPinball primitive parser', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
		});
	});

	after(async () => await api.teardown());

	it('should generate a simple primitive mesh', async () => {
		const vpxFile = await api.fileHelper.createVpx('member', 'table-primitive.vpx');
		const gltf = await three.loadGlb('member', vpxFile.variations.gltf);
		const cubeMesh = three.find(gltf, 'primitives', 'primitive-Cube');
		const cubeMeshVertices = cubeMesh.geometry.attributes.position;
		const expectedVertices = [
			[600.000000, 600.000000, 100.000000],
			[400.000000, 600.000000, 100.000000],
			[400.000000, 600.000000, -100.000000],
			[600.000000, 600.000000, -100.000000],
			[600.000000, 400.000000, -100.000000],
			[600.000000, 600.000000, -100.000000],
			[400.000000, 600.000000, -100.000000],
			[400.000000, 400.000000, -100.000000],
			[400.000000, 400.000000, -100.000000],
			[400.000000, 600.000000, -100.000000],
			[400.000000, 600.000000, 100.000000],
			[400.000000, 400.000000, 100.000000],
			[400.000000, 400.000000, 100.000000],
			[600.000000, 400.000000, 100.000000],
			[600.000000, 400.000000, -100.000000],
			[400.000000, 400.000000, -100.000000],
			[600.000000, 400.000000, 100.000000],
			[600.000000, 600.000000, 100.000000],
			[600.000000, 600.000000, -100.000000],
			[600.000000, 400.000000, -100.000000],
			[400.000000, 400.000000, 100.000000],
			[400.000000, 600.000000, 100.000000],
			[600.000000, 600.000000, 100.000000],
			[600.000000, 400.000000, 100.000000],
		];
		three.expectVerticesInArray(expectedVertices, cubeMeshVertices.array);
	});

	it('should generate a simple generated mesh', async () => {
		const vpxFile = await api.fileHelper.createVpx('member', 'table-primitive.vpx');
		const gltf = await three.loadGlb('member', vpxFile.variations.gltf);
		const triangleMesh = three.find(gltf, 'primitives', 'primitive-Triangle');
		const triangleMeshVertices = triangleMesh.geometry.attributes.position;
		const expectedVertices = [
			[526.975952, 913.236511, -246.442444],
			[536.197876, 831.975708, -188.895538],
			[479.393341, 907.225647, -334.190735],
			[565.336609, 1000.508118, -216.241028],
			[440.645935, 935.510925, -201.154724],
			[449.867889, 854.250183, -143.607819],
			[393.063324, 929.500061, -288.903015],
			[479.006622, 1022.782532, -170.953308],
			[536.197876, 831.975708, -188.895538],
			[479.393341, 907.225647, -334.190735],
			[565.336609, 1000.508118, -216.241028],
			[449.867889, 854.250183, -143.607819],
			[393.063324, 929.500061, -288.903015],
			[479.006622, 1022.782532, -170.953308],
		];
		three.expectVerticesInArray(expectedVertices, triangleMeshVertices.array);
	});

	it('should assign the correct material');
});
