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
const statSync = require('fs').statSync;
const expect = require('expect.js');

const shortId = require('shortid32');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);

const pngPath = resolve(__dirname, '../../data/test/files/backglass.png');

let res;

describe('The VPDB `file` API', () => {

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

		it('should fail when posting a corrupted file', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'rom', content_type: 'application/zip' })
				.withAttachment('zip', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});

		it('should succeed when uploading a backglass image', async () => {
			const member = api.getUser('member');
			const stats = statSync(pngPath);
			res = await api.onStorage()
				.as(member)
				.markTeardown()
				.withQuery({ type: 'backglass', content_type: 'image/png' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectStatus(201));
			expect(res.data.id).to.be.ok();
			expect(res.data.bytes).to.equal(stats.size);
			expect(res.data.metadata).to.be.an('object');
			expect(res.data.metadata.size).to.be.an('object');
			expect(res.data.metadata.size.width).to.equal(1280);
		});

	});

	describe('when uploading a text file', () => {

		it('should return an object with the same parameters as provided in the headers', async () => {
			const member = api.getUser('member');
			const fileType = 'release';
			const mimeType = 'text/plain';
			const name = 'text.txt';
			const text = 'should return an object with the same parameters as provided in the headers';
			res = await api.onStorage()
				.as(member)
				.markTeardown()
				.withQuery({ type: fileType })
				.withContentType(mimeType)
				.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
				.post('/v1/files', text)
				.then(res => res.expectStatus(201));

			expect(res.data.id).to.be.ok();
			expect(res.data.name).to.be(name);
			expect(res.data.bytes).to.be(text.length);
			expect(res.data.mime_type).to.be(mimeType);
			expect(res.data.file_type).to.be(fileType);
			expect(res.data.variations).to.be.empty();
		});
	});

	describe('when uploading a backglass image', () => {

		it('should return the correct dimensions and variations', async () => {
			const member = api.getUser('member');
			const backglass = await fileHelper.createBackglass(member);
			expect(backglass.id).to.be.ok();
			expect(backglass.metadata.size.width).to.be(640);
			expect(backglass.metadata.size.height).to.be(512);
			expect(backglass.variations.small).to.be.an('object');
			expect(backglass.variations.medium).to.be.an('object');
		});

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

	describe('when uploading a rar file', () => {

		it('should return the file listing of the archive', async () => {
			const rar = await fileHelper.createRar('moderator');
			expect(rar.metadata).to.be.an('object');
			expect(rar.metadata.entries).to.be.an('array');
			expect(rar.metadata.entries).to.have.length(3);
			expect(rar.metadata.entries[0].bytes).to.be.a('number');
			expect(rar.metadata.entries[0].bytes_compressed).to.be.a('number');
			expect(rar.metadata.entries[0].crc).to.be.a('number');
			expect(rar.metadata.entries[0].filename).to.be.a('string');
			expect(rar.metadata.entries[0].modified_at).to.be.a('string');
		});

		it('should fail if the rar file is corrupted', async () => {
			const data = '<corrupted rar data>';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'release' })
				.withContentType('application/rar')
				.withHeader('Content-Disposition', 'attachment; filename="dmd.rar"')
				.withHeader('Content-Length', String(data.length))
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});
	});

	describe('when uploading a zip file', () => {

		it('should return the file listing of the archive', async () => {
			const zip = await fileHelper.createZip('moderator');
			expect(zip.metadata).to.be.an('object');
			expect(zip.metadata.entries).to.be.an('array');
			expect(zip.metadata.entries).to.have.length(3);
			expect(zip.metadata.entries[0].bytes).to.be.a('number');
			expect(zip.metadata.entries[0].bytes_compressed).to.be.a('number');
			expect(zip.metadata.entries[0].crc).to.be.a('number');
			expect(zip.metadata.entries[0].filename).to.be.a('string');
			expect(zip.metadata.entries[0].modified_at).to.be.a('string');
		});

		it('should fail if the zip file is corrupted', async () => {
			const data = '<corrupted zip data>';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'release' })
				.withContentType('application/zip')
				.withHeader('Content-Disposition', 'attachment; filename="dmd.zip"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});
	});

	describe('when uploading a directb2s file', () => {

		it('should fail if the directb2s file is corrupted', async () => {
			const data = 'invalid data';
			await api.onStorage()
				.as('member')
				.withQuery({ type: 'backglass' })
				.withContentType('application/x-directb2s')
				.withHeader('Content-Disposition', 'attachment; filename="test.directb2s"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectError(400, 'metadata parsing failed'));
		});

	});

	describe('after successfully uploading a file', () => {

		it('should be able to retrieve the file details', async () => {
			const fileType = 'release';
			const mimeType = 'text/plain';
			const name = 'text.txt';
			res = await api.onStorage()
				.as('member')
				.markTeardown()
				.withQuery({ type: fileType })
				.withContentType(mimeType)
				.withHeader('Content-Disposition', 'attachment; filename="' + name + '"')
				.post('/v1/files', 'should be able to retrieve the file details')
				.then(res => res.expectStatus(201));
			expect(res.data.url).to.be.ok();
			res = await api
				.as('member')
				.save('files/view')
				.get('/v1/files/' + res.data.id)
				.then(res => res.expectStatus(200));
			expect(res.data.name).to.be(name);
			expect(res.data.file_type).to.be(fileType);
			expect(res.data.mime_type).to.be(mimeType);
		});

		it('should contain the links of the variations in the response of the file upload');

		it('should fail to retrieve the file details as anonymous', async () => {
			res = await api.onStorage()
				.as('member')
				.markTeardown()
				.withQuery({ type: 'release' })
				.withContentType('text/plain')
				.withHeader('Content-Disposition', 'attachment; filename="text.txt"')
				.post('/v1/files', 'should fail to retrieve the file details as anonymous')
				.then(res => res.expectStatus(201));

			expect(res.data.url).to.be.ok();
			await api.get('/v1/files/' + res.data.id).then(res => res.expectError(401, 'is inactive'));
		});

		it('should fail to retrieve the file details as a different user', async () => {
			res = await api.onStorage()
				.as('member')
				.markTeardown()
				.withQuery({ type: 'release' })
				.withContentType('text/plain')
				.withHeader('Content-Disposition', 'attachment; filename="text.txt"')
				.post('/v1/files', 'should fail to retrieve the file details as a different user')
				.then(res => res.expectStatus(201));

			expect(res.data.url).to.be.ok();
			await api.as('anothermember').get('/v1/files/' + res.data.id).then(res => res.expectError(403, 'is inactive'));
		});

		it('should fail when trying to retrieve the file as anonymous', async () => {
			res = await api.onStorage()
				.as('member')
				.markTeardown()
				.withQuery({ type: 'release' })
				.withContentType('text/plain')
				.withHeader('Content-Disposition', 'attachment; filename="text.txt"')
				.post('/v1/files', 'should fail when trying to retrieve the file as anonymous')
				.then(res => res.expectStatus(201));

			await api.getAbsolute(ApiClient.urlPath(res.data.url)).then(res => res.expectStatus(401));
		});

	});

	describe('when deleting a file', () => {

		it('should succeed as owner of the file', async () => {
			const user = 'member';

			// 1. upload
			res = await api.onStorage()
				.as(user)
				.withQuery({ type: 'release' })
				.withContentType('text/plain')
				.withHeader('Content-Disposition', 'attachment; filename="text.txt"')
				.post('/v1/files', 'should succeed as owner of the file')
				.then(res => res.expectStatus(201));
			expect(res.data.url).to.be.ok();
			const id = res.data.id;
			const url = res.data.url;

			// 2. check it's there
			await api.as(user).getAbsolute(ApiClient.urlPath(url)).then(res => res.expectStatus(200));

			// 3. delete
			await api.as(user).del('/v1/files/' + id).then(res => res.expectStatus(204));

			// 4. check it's not there
			await api.as(user).getAbsolute(ApiClient.urlPath(url)).then(res => res.expectStatus(404));
		});

		it('should fail if not owner of the file', async () => {

			// 1. upload
			res = await api.onStorage()
				.as('member')
				.markTeardown()
				.withQuery({ type: 'release' })
				.withContentType('text/plain')
				.withHeader('Content-Disposition', 'attachment; filename="text.txt"')
				.post('/v1/files', 'should fail if not owner of the file')
				.then(res => res.expectStatus(201));

			expect(res.data.id).to.be.ok();
			expect(res.data.url).to.be.ok();

			await api.as('anothermember').del('/v1/files/' + res.data.id).then(res => res.expectError(403));
		});

		// it('should fail if the file is active', async () => {
		// 	var user = 'moderator';
		// 	hlp.game.createGame(user, request, function(game) {
		// 		request.del('/api/v1/files/' + game.backglass.id).as(user).end(hlp.status(400, 'Cannot remove active file', done));
		// 	});
		// });

	});

	describe('before trying to upload a file', () => {

		it('should fail when no "Content-Disposition" header is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'backglass' })
				.post('/v1/files', 'xxx');

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
				.withHeader('Content-Type', 'suck/it')
				.withQuery({ type: 'release' })
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Invalid "Content-Type" header'));
		});
	});

});