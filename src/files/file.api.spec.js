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

const expect = require('expect.js');
const shortId = require('shortid32');
shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const FileHelper = require('../../test/modules/file.helper');
const GameHelper = require('../../test/modules/game.helper');

const api = new ApiClient();
const fileHelper = new FileHelper(api);
const gameHelper = new GameHelper(api);

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

	describe('when viewing an active file', () => {

		let activeFile;
		before(async () => {
			const game = await gameHelper.createGame('moderator');
			activeFile = (await api.get('/v1/files/' + game.backglass.id).then(res => res.expectStatus(200))).data;
		});

		it('should fail for invalid file id', async () => {
			await api.get('/v1/files/zurrg').then(res => res.expectError(404, 'no such file'));
		});

		it('should display file details', async () => {
			res = await api.save('files/view').get('/v1/files/' + activeFile.id).then(res => res.expectStatus(200));
			const img = res.data;
			expect(img.name).to.be('backglass.png');
			expect(img.mime_type).to.be('image/png');
			expect(img.is_protected).to.be(true);
			expect(img.is_active).to.be(true);
			expect(img.variations.full.url).to.be.ok();
			expect(img.variations.medium.url).to.be.ok();
			expect(img.variations['medium-2x'].url).to.be.ok();
			expect(img.variations.small.url).to.be.ok();
			expect(img.variations['small-2x'].url).to.be.ok();
			expect(img.file_type).to.be('backglass');
			expect(img.metadata.format).to.be('PNG');
			expect(img.metadata.size.width).to.be(640);
			expect(img.metadata.size.height).to.be(512);
			expect(img.metadata.depth).to.be(8);
		});

	});

	describe('when viewing an inactive file', () => {

		let inactiveFile;
		before(async () => {
			inactiveFile = await fileHelper.createBackglass('member');
		});

		it('should fail to retrieve the file details as anonymous', async () => {
			await api.get('/v1/files/' + inactiveFile.id).then(res => res.expectError(401, 'is inactive'));
		});

		it('should fail to retrieve the file details as a different user', async () => {
			await api.as('anothermember').get('/v1/files/' + inactiveFile.id).then(res => res.expectError(403, 'is inactive'));
		});

		it('should succeed retrieving the file details as the uploader', async () => {
			await api.as('member').get('/v1/files/' + inactiveFile.id).then(res => res.expectStatus(200));
		});

	});

	describe('when deleting a file', () => {

		it('should fail if the file does not exist', async () => {
			await api.as('moderator').del('/v1/files/sabbelnicht').then(res => res.expectError(404, 'no such file'));
		});

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

		it('should fail if the file is active', async () => {
			const user = 'moderator';
			const game = await gameHelper.createGame(user);
			await api.as(user).del('/v1/files/' + game.backglass.id).then(res => res.expectError(400, 'Cannot remove active file'));
		});

	});

});