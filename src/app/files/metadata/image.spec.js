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

'use strict';
/*global describe, before, after, it*/

const expect = require('expect.js');

const ApiClient = require('../../../test/api.client');
const FileHelper = require('../../../test/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

describe('The VPDB `file` API for images', () => {

	before(async () => {
		await api.setupUsers({ member: { roles: ['member'] } });
	});

	after(async () => await api.teardown());

	describe('when uploading a backglass image', () => {

		it('should fail if the upload is not an png image', async () => {
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'backglass' })
				.withContentType('image/png')
				.withHeader('Content-Disposition', 'attachment; filename="backglass.png"')
				.post('/v1/files', 'not an image!')
				.then(res => res.expectError(400, 'metadata parsing failed'));

		});

		it('should fail if the upload is not a jpeg image', async () => {
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'backglass' })
				.withContentType('image/jpeg')
				.withHeader('Content-Disposition', 'attachment; filename="backglass.jpg"')
				.post('/v1/files', 'not an image!')
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});

		it('should fail if the aspect ratio too much off');

		it('should return the correct dimensions and variations', async () => {
			const member = api.getUser('member');
			const backglass = await fileHelper.createBackglass(member);
			expect(backglass.id).to.be.ok();
			expect(backglass.metadata.size.width).to.be(640);
			expect(backglass.metadata.size.height).to.be(512);
			expect(backglass.variations.small).to.be.an('object');
			expect(backglass.variations.medium).to.be.an('object');
		});

	});

	describe('when uploading a playfield image', () => {

		it('should return the correct variations', async () => {
			const member = api.getUser('member');
			const playfield = await fileHelper.createPlayfield(member, 'fs');
			expect(playfield.id).to.be.ok();
			expect(playfield.variations).to.be.an('object');
			expect(playfield.variations.medium).to.be.an('object');
			expect(playfield.variations['medium-2x']).to.be.an('object');
			expect(playfield.variations.square).to.be.an('object');
			expect(playfield.variations['square-2x']).to.be.an('object');
		});
	});

});