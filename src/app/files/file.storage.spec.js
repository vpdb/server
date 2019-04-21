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

const resolve = require('path').resolve;
const statSync = require('fs').statSync;
const expect = require('expect.js');
const shortId = require('shortid32');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/api.client');
const api = new ApiClient();

const pngPath = resolve(__dirname, '../../test/fixtures/backglass.png');

let res;

describe('The VPDB `file` storage API', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: [ 'member' ]},
			moderator: { roles: [ 'moderator' ] },
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ] },
			unlimited: { roles: [ 'member' ], _plan: 'subscribed' }
		});
	});

	after(async () => await api.teardown());

	it('should fail for a non-existent file', async () => {
		await api.onStorage().get('/public/files/foobar.jpg').then(res => res.expectError(404, 'no such file'));
	});

	describe('when uploading a file using a multipart request', () => {

		it('should fail when no "type" query parameter is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'Query parameter "type" must be provided'));
		});

		it('should fail an invalid "type" query parameter is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'foobar' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'Unknown "type" parameter'));
		});

		it('should fail when no content type is provided in the header', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withContentType('')
				.post('/v1/files', '1234')
				.then(res => res.expectError(422, '"Content-Type" must be provided'));
		});

		it('should fail when providing no mime type as query parameter', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'Mime type must be provided as query parameter'));
		});

		it('should fail when providing a bogus mime type', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release', content_type: 'suck/it' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'Invalid "Content-Type" parameter'));
		});

		it('should fail when providing an invalid mime type in header', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release', content_type: 'image/jpeg' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'Invalid "Content-Type" parameter'));
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

	describe('when uploading a file as raw data', () => {

		it('should fail when no "type" query parameter is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Query parameter "type" must be provided'));
		});

		it('should fail an invalid "type" query parameter is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'foobar' })
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Unknown "type" parameter'));
		});

		it('should fail when providing no mime type in header', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withHeader('Content-Type', '')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Header "Content-Type" must be provided'));
		});

		it('should fail when providing a bogus mime type in header', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withHeader('Content-Type', 'suck/it')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Invalid "Content-Type" header'));
		});

		it('should fail when providing an invalid mime type in header', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withHeader('Content-Type', 'image/jpeg')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Invalid "Content-Type" header'));
		});

		it('should fail when no "Content-Disposition" header is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'backglass' })
				.withHeader('Content-Type', 'image/jpeg')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Header "Content-Disposition" must be provided'));

		});

		it('should fail when a bogus "Content-Disposition" header is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'backglass' })
				.withHeader('Content-Type', 'image/jpeg')
				.withHeader('Content-Disposition', 'zurg!!')
				.post('/v1/files', 'xxx')
				.then(res => res.expectError(422, 'Header "Content-Disposition" must contain file name'));
		});

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

	describe('when downloading an inactive file', () => {

		let inactiveFile;
		before(async () => {
			inactiveFile = await api.fileHelper.createBackglass('member');
		});

		it('should fail downloading through the public URL as anonymous', async () => {
			await api.onStorage().get('/public/files/' + inactiveFile.id + '.jpg').then(res => res.expectError(401, 'Must be logged'));
		});

		it('should fail downloading the file as a different user', async () => {
			await api.onStorage().as('anothermember').getAbsolute(inactiveFile.url).then(res => res.expectError(403, 'must own inactive files'));
		});

		it('should fail downloading the file through the public URL as a different user', async () => {
			await api.onStorage().as('anothermember').get('/public/files/' + inactiveFile.id + '.jpg').then(res => res.expectError(403, 'must own inactive files'));
		});

		it('should succeed downloading the file as the uploader', async () => {
			await api.onStorage().as('member').getAbsolute(inactiveFile.url).then(res => res.expectStatus(200));
		});

		it('should block until the variation started and finished processing', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			res = await api.onStorage().as('member').getAbsolute(backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
		});

		it('should block until the variation finished processing', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			res = await api.onStorage().as('member').getAbsolute(backglass.variations['full'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
		});

		it('should only return the header when requesting a HEAD on the storage URL', async () => {
			const textFile = await api.fileHelper.createTextfile('member');
			res = await api.onStorage().as('member').headAbsolute(textFile.url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be('0');
			expect(res.data).to.not.be.ok();
		});

		it('should block until the file is finished processing when requesting the HEAD of a variation', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			res = await api.onStorage().as('member').headAbsolute(backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be('0');
			expect(res.data).to.not.be.ok();
		});

		it('should block a video variation until processing is finished', async () => {
			const video = await api.fileHelper.createMp4('moderator');
			// now spawn 5 clients that try to retrieve this simultaneously
			const token = api.getToken('moderator');
			const reqs = [];
			for (let i = 0; i < 5; i++) {
				reqs.push(() => new ApiClient()
					.withToken(token)
					.getAbsolute(video.variations['small-rotated'].url)
					.then(res => res.expectStatus(200)).then(res => {
						expect(res.headers['content-length']).to.be.greaterThan(0);
						expect(res.data.length).to.be.greaterThan(0);
					})
				);
			}
			await Promise.all(reqs.map(r => r()));
		});

		it('should block a video variation with a different MIME type until processing is finished', async () => {
			const video = await api.fileHelper.createAvi('moderator');
			res = await api
				.as('moderator')
				.getAbsolute(video.variations['small-rotated'].url)
				.then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
			expect(res.data.length).to.be.greaterThan(0);
		});

		it('should block HEAD of a video variation with a different MIME type until processing is finished', async () => {
			const video = await api.fileHelper.createAvi('moderator');
			res = await api
				.as('moderator')
				.headAbsolute(video.variations['small-rotated'].url)
				.then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be('0');
			expect(res.data.length).to.be(0);
		});
	});

	describe('when downloading an active file', () => {

		let activeFile;
		before(async () => {
			const bg = await api.releaseHelper.createDirectB2S('moderator');
			activeFile = (await api.get('/v1/files/' + bg.versions[0].file.id).then(res => res.expectStatus(200))).data;
		});

		it('should fail downloading the file as anonymous', async () => {
			await api.onStorage().getAbsolute(activeFile.url).then(res => res.expectError(401, 'Unauthorized'));
		});

		it('should fail downloading through the public URL as anonymous', async () => {
			await api.onStorage().get('/public/files/' + activeFile.id + '.jpg').then(res => res.expectError(401, 'Must be logged'));
		});

		it('should fail for a non-existing variation', async () => {
			await api.onStorage().get('/public/files/asdf/' + activeFile.id + '.jpg').then(res => res.expectError(404, 'No such variation'));
		});

		it('should succeed downloading the file as the owner', async () => {
			res = await api.onStorage().as('moderator').getAbsolute(activeFile.url).then(res => res.expectStatus(200));
			expect(res.data.length).to.be.greaterThan(100);
		});

		it('should succeed downloading a variation as anonymous', async () => {
			res = await api.onStorage().getAbsolute(activeFile.variations.full.url).then(res => res.expectStatus(200));
			expect(res.data.length).to.be.greaterThan(100);
		});

		it('should succeed downloading the file as a logged user', async () => {
			res = await api.onStorage().as('anothermember').getAbsolute(activeFile.url).then(res => res.expectStatus(200));
			expect(res.data.length).to.be.greaterThan(100);
		});

		it('should succeed downloading using a storage token', async () => {
			const token = await api.retrieveStorageToken('contributor', activeFile.url);
			res = await api
				.onStorage()
				.withQuery({ token: token })
				.getAbsolute(activeFile.url)
				.then(res => res.expectStatus(200));
			expect(res.data.length).to.be.greaterThan(100);
		});

		it('should block until the variation is finished processing', async () => {
			const game = await api.gameHelper.createGame('moderator');
			res = await api.onStorage().as('member').getAbsolute(game.backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
		});

		it('should add the content-disposition header when asked to', async () => {
			res = await api.onStorage().as('unlimited').withQuery({ save_as: 1 }).getAbsolute(activeFile.url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
			expect(res.headers['content-disposition']).to.contain('attachment');
		});

	});

	describe('when providing cache headers', () => {

		it('should return a "Last-Modified" header for all storage items.', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			const token = await api.retrieveStorageToken('member', backglass.url);
			await api.onStorage()
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(200).expectHeader('last-modified'));
		});

		it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			const token = await api.retrieveStorageToken('member', backglass.url);
			res = await api.onStorage()
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(200));

			const lastModified = res.response.headers['last-modified'];
			await api.onStorage()
				.withQuery({ token: token })
				.withHeader('If-Modified-Since', lastModified)
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(304));
		});
	});
});