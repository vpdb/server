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
const GameHelper = require('../../test/modules/game.helper');
const ReleaseHelper = require('../../test/modules/release.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);
const gameHelper = new GameHelper(api);

const pngPath = resolve(__dirname, '../../data/test/files/backglass.png');

let res;

describe('The VPDB `file` storage API', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: [ 'member' ]},
			moderator: { roles: [ 'moderator' ], _plan: 'subscribed'},
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ]}
		});
	});

	after(async () => await api.teardown());

	describe('when uploading a file using a multipart request', () => {

		it('should fail when no content type is provided in the header', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withContentType('')
				.post('/v1/files', '1234')
				.then(res => res.expectError(422, '"Content-Type" must be provided'));
		});

		it('should fail when no file type is provided', async () => {
			const member = api.getUser('member');
			await api.onStorage()
				.as(member)
				.withQuery({ type: 'release' })
				.withAttachment('image', pngPath)
				.post('/v1/files')
				.then(res => res.expectError(422, 'mime type must be provided as query parameter'));
		});

		it('should fail when an invalid content type is provided in the query', async () => {
			const member = api.getUser('member');
			res = await api.onStorage()
				.as(member)
				.withAttachment('image', pngPath)
				.withQuery({ type: 'backglass', content_type: 'animal/bear' })
				.post('/v1/files')
				.then(res => res.expectError(422, 'Invalid "Content-Type"'));
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
			inactiveFile = await fileHelper.createBackglass('member');
		});

		it('should fail downloading the file as anonymous', async () => {
			await api.onStorage().getAbsolute(inactiveFile.url).then(res => res.expectError(401, 'Unauthorized'));
		});

		it('should fail downloading the file as a different user', async () => {
			await api.onStorage().as('anothermember').getAbsolute(inactiveFile.url).then(res => res.expectError(403, 'must own inactive files'));
		});

		it('should succeed downloading the file as the uploader', async () => {
			await api.onStorage().as('member').getAbsolute(inactiveFile.url).then(res => res.expectStatus(200));
		});

		it('should block until the variation is finished processing', async () => {
			const backglass = await fileHelper.createBackglass('member');
			res = await api.onStorage().as('member').getAbsolute(backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
		});

		it('should only return the header when requesting a HEAD on the storage URL', async () => {
			const textFile = await fileHelper.createTextfile('member');
			res = await api.onStorage().as('member').headAbsolute(textFile.url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be('0');
			expect(res.data).to.not.be.ok();
		});

		it('should block until the file is finished processing when requesting the HEAD of a variation', async () => {
			const backglass = await fileHelper.createBackglass('member');
			res = await api.onStorage().as('member').headAbsolute(backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be('0');
			expect(res.data).to.not.be.ok();
		});

		it('should block a video variation until processing is finished', async () => {
			const video = await fileHelper.createMp4('moderator');
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
			const video = await fileHelper.createAvi('moderator');
			res = await api
				.as('moderator')
				.getAbsolute(video.variations['small-rotated'].url)
				.then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
			expect(res.data.length).to.be.greaterThan(0);
		});

		it('should block HEAD of a video variation with a different MIME type until processing is finished', async () => {
			const video = await fileHelper.createAvi('moderator');
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
			const game = await gameHelper.createGame('moderator');
			activeFile = (await api.get('/v1/files/' + game.backglass.id).then(res => res.expectStatus(200))).data;
		});

		it('should fail downloading the file as anonymous', async () => {
			await api.onStorage().getAbsolute(activeFile.url).then(res => res.expectError(401, 'Unauthorized'));
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
			const game = await gameHelper.createGame('moderator');
			res = await api.onStorage().as('member').getAbsolute(game.backglass.variations['small-2x'].url).then(res => res.expectStatus(200));
			expect(res.headers['content-length']).to.be.greaterThan(0);
		});

	});

	describe('when providing cache headers', () => {

		it('should return a "Last-Modified" header for all storage items.', async () => {
			const backglass = await fileHelper.createBackglass('member');
			const token = await api.retrieveStorageToken('member', backglass.url);
			await api.onStorage()
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(backglass.url))
				.then(res => res.expectStatus(200).expectHeader('last-modified'));
		});

		it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', async () => {
			const backglass = await fileHelper.createBackglass('member');
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