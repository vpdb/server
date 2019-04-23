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
const scale = 0.05;

describe('The VPinball lights generator', () => {

	let vpxFile, gltf;

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
		});
		vpxFile = await api.fileHelper.createVpx('member', 'table-light.vpx');
		gltf = await three.loadGlb('member', vpxFile.variations.gltf);
	});

	after(async () => {
		await api.teardown();
	});

	it('should generate a static light bulb mesh', async () => {
		three.expectObject(gltf, 'lightsBulbs', 'bulblight-StaticBulb');
	});

	it('should generate a light bulb mesh', async () => {
		three.expectObject(gltf, 'lightsBulbs', 'bulblight-Bulb');
	});

	it('should generate a scaled light bulb mesh', async () => {
		// TODO find a way to test scaling (vpx obj export doesn't export light bulbs)
		three.expectObject(gltf, 'lightsBulbs', 'bulblight-Scaled');
	});

	it('should generate a light bulb mesh on a surface', async () => {
		// TODO find a way to test (vpx obj export doesn't export light bulbs)
		three.expectObject(gltf, 'lightsBulbs', 'bulblight-Surface');
	});

	it('should not generate a light bulb with no bulb mesh', async () => {
		three.expectNoObject(gltf, 'lightsBulbs', 'bulblight-NoBulb');
	});

	it('should not generate a light with no bulb mesh', async () => {
		three.expectNoObject(gltf, 'lights', 'light-NoBulb');
	});

	it('should generate a light with default parameters', async () => {
		const light = three.find(gltf, 'lights', 'lightStaticBulb');
		expect(light.decay).to.be(2);
		expect(light.intensity).to.be(1);
		expect(light.distance).to.be(scale * 50);
		expect(light.color).to.eql({ r: 1, g: 1, b: 0 });
	});

	it('should generate a light with custom parameters', async () => {
		const light = three.find(gltf, 'lights', 'lightCustomParams');
		expect(light.decay).to.be(2);
		expect(Math.round(light.intensity * 1000) / 1000).to.be(5.2);
		expect(Math.round(light.distance * 1000) / 1000).to.be(scale * 64.1);
		expect(light.color).to.eql({
			r: 0.34901960784313724,
			g: 0.9333333333333333,
			b: 0.06666666666666667 });
	});
});
