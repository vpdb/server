/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

const resolve = require('path').resolve;
const expect = require('expect.js');

const shortId = require('shortid32');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

const pngPath = resolve(__dirname, '../../data/test/files/backglass.png');

let res;

describe.only('The VPDB `file` API', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			anothermember: { roles: ['member'] }
		});
	});

	after(async () => await api.teardown());

	describe('when uploading a file using a multipart request', () => {

		it('should fail when no content type is provided in the query', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'mime type must be provided as query parameter'));
		});

		it('should fail when posting more than one file', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'backglass', content_type: 'image/png' })
				.withAttachment('image1', pngPath)
				.withAttachment('image2', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'must only contain one file'));
		});

		// it('should fail when posting a corrupted file', async () => {
		// 	request
		// 		.post('/storage/v1/files')
		// 		.query({ type: 'rom', content_type: 'application/zip' })
		// 		.as('member')
		// 		.attach('zip', pngPath)
		// 		.end(hlp.status(400, 'metadata parsing failed', done));
		// });

		// it('should succeed when uploading a backglass image', async () => {
		// 	var stats = fs.statSync(pngPath);
		// 	request
		// 		.post('/storage/v1/files')
		// 		.query({ type: 'backglass', content_type: 'image/png' })
		// 		.as('member')
		// 		.attach('image', pngPath)
		// 		.end(function(err, res) {
		// 			hlp.expectStatus(err, res, 201);
		// 			hlp.doomFile('member', res.body.id);
		// 			expect(res.body.id).to.be.ok();
		// 			expect(res.body.bytes).to.equal(stats.size);
		// 			expect(res.body.metadata).to.be.an('object');
		// 			expect(res.body.metadata.size).to.be.an('object');
		// 			expect(res.body.metadata.size.width).to.equal(1280);
		// 			done();
		// 		});
		// });

	});

	describe('before trying to upload a file', () => {

		it('should fail when no "Content-Disposition" header is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'backglass' })
				.post('/v1/files', 'xxx')

		});

		it('should fail when a bogus "Content-Disposition" header is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withHeader('Content-Disposition', 'zurg!!')
				.withQuery({ type: 'backglass' })
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Content-Disposition'));
		});

		it('should fail when no "type" query parameter is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withHeader('Content-Disposition', 'attachment; filename="foo.bar"')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'type'));
		});

		it('should fail when providing wrong mime type in header', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withHeader('Content-Disposition', 'attachment; filename="foo.bar"')
				.withQuery({ type: 'release' })
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422));

			expect(res.data.errors).to.be.an('array');
			expect(res.data.errors[0].message).to.contain('Invalid MIME type');
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