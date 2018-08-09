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

const ApiClient = require('../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `blockmatch` API', () => {

	describe('when trying to match a file', () => {

		before(async () => {
			await api.setupUsers({ moderator: { roles: ['moderator'] } });
		});

		after(async () => await api.teardown());

		it('should fail if the file does not exist', async () => {
			await api.as('moderator').get('/v1/files/züürglz/blockmatch').then(res => res.expectStatus(404));
		});

		it('should fail if the file is not a table file', async () => {
			const bg = await api.fileHelper.createBackglass('moderator');
			await api.as('moderator').get('/v1/files/' + bg.id + '/blockmatch').then(res => res.expectError(400, 'can only match table files'));
		});

		it('should fail if the file is not linked to a release', async () => {
			const vpt = await api.fileHelper.createVpt('moderator');
			await api.as('moderator').get('/v1/files/' + vpt.id + '/blockmatch').then(res => res.expectError(400, 'release reference missing'));
		});

		it('should match the file from a different release', async () => {

			const release1 = await api.releaseHelper.createRelease('moderator');
			const release2 = await api.releaseHelper.createRelease('moderator', { alternateVpt: true });
			expect(release1.versions[0].files[0].file.bytes).not.to.be(release2.versions[0].files[0].file.bytes);

			res = await api
				.as('moderator')
				.save('files/blockmatch')
				.get('/v1/files/' + release1.versions[0].files[0].file.id + '/blockmatch')
				.then(res => res.expectStatus(200));

			// file to be matched
			expect(res.data.game.id).to.be(release1.game.id);
			expect(res.data.version.version).to.be(release1.versions[0].version);
			expect(res.data.file.file.id).to.be(release1.versions[0].files[0].file.id);

			// matches
			expect(res.data.matches).to.have.length(1);
			expect(res.data.matches[0].game.id).to.be(release2.game.id);
			expect(res.data.matches[0].version.version).to.be(release2.versions[0].version);
			expect(res.data.matches[0].file.file.id).to.be(release2.versions[0].files[0].file.id);

		});
	});

	describe('when trying to match a file from the same release', () => {

		let release;
		const version = '2.0';
		let file;

		before(async () => {
			await api.setupUsers({ moderator: { roles: ['moderator'] } });
			release = await api.releaseHelper.createRelease('moderator');
			file = await api.fileHelper.createVpt('moderator', { alternateVpt: true, keep: true });
			const pf = await api.fileHelper.createPlayfield('moderator', 'ws', null, { keep: true });
			await api
				.as('moderator')
				.post('/v1/releases/' + release.id + '/versions', {
					version: version,
					files: [{
						_file: file.id,
						_playfield_image: pf.id,
						_compatibility: ['9.9.0'],
						flavor: { 'orientation': 'ws', 'lighting': 'night' }
					}]
				})
				.then(res => res.expectStatus(201));
		});

		after(async () => await api.teardown());

		it('should not match a file', async () => {
			res = await api
				.as('moderator')
				.get('/v1/files/' + release.versions[0].files[0].file.id + '/blockmatch')
				.then(res => res.expectStatus(200));

			// file to be matched
			expect(res.data.game.id).to.be(release.game.id);
			expect(res.data.version.version).to.be(release.versions[0].version);
			expect(res.data.file.file.id).to.be(release.versions[0].files[0].file.id);

			// matches
			expect(res.data.matches).to.be.empty();
		});

		it('should match the file when specified', async () => {
			res = await api
				.as('moderator')
				.withQuery({ include_same_release: true })
				.get('/v1/files/' + release.versions[0].files[0].file.id + '/blockmatch')
				.then(res => res.expectStatus(200));

			// file to be matched
			expect(res.data.matches).to.have.length(1);
			expect(res.data.game.id).to.be(release.game.id);
			expect(res.data.version.version).to.be(release.versions[0].version);
			expect(res.data.file.file.id).to.be(release.versions[0].files[0].file.id);

			// matches
			expect(res.data.matches[0].game.id).to.be(release.game.id);
			expect(res.data.matches[0].version.version).to.be('2.0');
			expect(res.data.matches[0].file.file.id).to.be(file.id);

		});
	});
});

