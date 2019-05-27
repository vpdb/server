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

"use strict"; /* global describe, before, after, it */

const expect = require('expect.js');
const ApiClient = require('../../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `Release Version` API', () => {

	describe('when adding a new version to an existing release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				member2: { roles: ['member'] },
				othermember: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			});
		});

		after(async () => await api.teardown());

		it('should fail when logged as a different user', async () => {
			const release = await api.releaseHelper.createRelease('member');
			await api.as('member2')
				.saveResponse('releases/create-version')
				.post('/v1/releases/' + release.id + '/versions', {})
				.then(res => res.expectError(403, 'only moderators or authors of the release'));
		});

		it('should fail validations when providing valid file reference with invalid meta data', async () => {

			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			const vptfile = await api.fileHelper.createVpt('member');
			await api.as(user)
				.post('/v1/releases/' + release.id + '/versions', {
					version: '2.0.0',
					changes: '*Second release.*',
					files: [
						{ _file: vptfile.id },
						{ _file: vptfile.id, flavor: {} },
						{ _file: vptfile.id, flavor: { orientation: 'invalid' } },
						{ _file: vptfile.id },
						{ _file: vptfile.id, _compatibility: ['non-existent'] }
					]
				}).then(res => res.expectValidationErrors([
					['files.0.flavor.orientation', 'must be provided'],
					['files.0.flavor.lighting', 'must be provided'],
					['files.0._compatibility', 'must be provided'],
					['files.1.flavor.orientation', 'must be provided'],
					['files.1.flavor.lighting', 'must be provided'],
					['files.2.flavor.orientation', 'invalid orientation'],
					['files.3._compatibility', 'must be provided'],
					['files.4._compatibility.0', 'no such build'],
					['files.0._playfield_image', 'must be provided'],
				]));
		});

		it('should fail when adding an existing version', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			await api.as(user)
				.saveResponse('releases/create-version')
				.post('/v1/releases/' + release.id + '/versions', {
					version: '1.0.0',
					changes: '*Second release.*',
					files: [{
						_file: '12345',
						_playfield_image: '67890',
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}]
				})
				.then(res => res.expectValidationError('version', 'version already exists'));
		});

		it('should succeed when providing valid data', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			const vptfile = await api.fileHelper.createVpt(user,  { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', undefined,  { keep: true });

			res = await api.as(user)
				.save('releases/create-version')
				.post('/v1/releases/' + release.id + '/versions', {
					version: '2.0.0',
					changes: '*Second release.*',
					files: [{
						_file: vptfile.id,
						_playfield_image: playfield.id,
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}]
				})
				.then(res => res.expectStatus(201));

			const version = res.data;
			expect(version).to.be.ok();
			expect(version.changes).to.be('*Second release.*');
		});

		it('should succeed when logged as non-creator but author', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			let originalAuthors = release.authors.map(a => ({ _user: a.user.id, roles: a.roles }));
			await api.as(user)
				.patch('/v1/releases/' + release.id,
					{
						authors: [...originalAuthors, {
							_user: api.getUser('othermember').id,
							roles: ['Some other job']
						}]
					})
				.then(res => res.expectStatus(200));

			const vptfile = await api.fileHelper.createVpt('othermember',  { keep: true });
			const playfield = await api.fileHelper.createPlayfield('othermember', 'fs', undefined,  { keep: true });
			res = await api.as('othermember')
				.post('/v1/releases/' + release.id + '/versions', {
					version: '2.0.0',
					changes: '*Second release.*',
					files: [{
						_file: vptfile.id,
						_playfield_image: playfield.id,
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}]
				})
				.then(res => res.expectStatus(201));
			const version = res.data;
			expect(version).to.be.ok();
			expect(version.changes).to.be('*Second release.*');
		});

		it('should succeed when logged as non-creator but moderator', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			const vptfile = await api.fileHelper.createVpt(user,  { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', undefined,  { keep: true });
			res = await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions', {
					version: '2.0.0',
					changes: '*Second release.*',
					files: [{
						_file: vptfile.id,
						_playfield_image: playfield.id,
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'night' }
					}]
				})
				.then(res => res.expectStatus(201));
			const version = res.data;
			expect(version).to.be.ok();
			expect(version.changes).to.be('*Second release.*');
		});
	});

	describe('when updating an existing version of a release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
		});

		after(async () => await api.teardown());

		it('should fail when logged as a different user', async () => {
			const release = await api.releaseHelper.createRelease('member');
			await api.as('member2')
				.saveResponse('releases/update-version')
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, {})
				.then(res => res.expectError(403, 'only moderators and authors of the release'));
		});

		it('should fail for duplicate compat/flavor', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			const versionFile = release.versions[0].files[0];
			const vptfile = await api.fileHelper.createVpt(user);
			const playfield = await api.fileHelper.createPlayfield(user, 'fs');
			const data = {
				files: [{
					_file: vptfile.id,
					_playfield_image: playfield.id,
					_compatibility: versionFile.compatibility.map(c => c.id),
					flavor: versionFile.flavor
				}]
			};
			await api.as(user)
				.saveResponse('releases/update-version')
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, data)
				.then(res => res.expectValidationErrors([
					['files.0._compatibility', 'compatibility and flavor already exists'],
					['files.0.flavor', 'compatibility and flavor already exists'],
				]));
		});

		it('should succeed for same version', async () => {
			const user = 'member';
			const version = '1.0';
			const release = await api.releaseHelper.createRelease(user, { version: '1.0' });
			await api.as(user)
				.patch('/v1/releases/' + release.id + '/versions/' + version, { version: version })
				.then(res => res.expectStatus(200));
		});

		it('should fail for duplicate version', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user, { version: '1.0.0' });
			const vptfile = await api.fileHelper.createVpt(user,  { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', undefined,  { keep: true });
			await api.as(user)
				.post('/v1/releases/' + release.id + '/versions', {
					version: '2.0.0',
					changes: '*Second release.*',
					files: [ {
						_file: vptfile.id,
						_playfield_image: playfield.id,
						_compatibility: [ '9.9.0' ],
						flavor: { orientation: 'fs', lighting: 'night' }
					} ]
				})
				.then(res => res.expectStatus(201));
			await api.as(user)
				.patch('/v1/releases/' + release.id + '/versions/2.0.0', { version: '1.0.0' })
				.then(res => res.expectValidationError('version', 'provided version already exists'));
		});

		it('should succeed when providing valid data', async () => {
			const user = 'member';
			const newChanges = 'New changes.';
			const newVersion = 'v666';
			const release = await api.releaseHelper.createRelease(user);
			const vptfile = await api.fileHelper.createVpt(user,  { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'fs',  undefined, { keep: true });
			res = await api.as(user)
				.save('releases/update-version')
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, {
					version: newVersion,
					changes: newChanges,
					files: [{
						_file: vptfile.id,
						_playfield_image: playfield.id,
						_compatibility: ['9.9.0'],
						flavor: { orientation: 'fs', lighting: 'day' }
					}]
				})
				.then(res => res.expectStatus(200));
			expect(res.data.changes).to.be(newChanges);
			expect(res.data.version).to.be(newVersion);
		});

		it('should fail when data is missing', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			const vptfile = await api.fileHelper.createVpt(user);
			await api.as(user)
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, {
					files: [{
						_file: vptfile.id,
						flavor: {},
						_compatibility: [],
						_playfield_image: null,
						_playfield_video: null
					}]
				})
				.then(res => res.expectValidationErrors([
					['files.0._compatibility', 'must be provided'],
					['files.0._playfield_image', 'must be provided'],
					['files.0.flavor.lighting', 'must be provided'],
					['files.0.flavor.orientation', 'must be provided'],
				]));
		});

		it('should succeed when rotating an existing playfield image', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			let playfieldImage = release.versions[0].files[0].playfield_image;
			res = await api.as(user)
				.withQuery({ rotate: release.versions[0].files[0].playfield_image.id + ':90' })
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, {
					files: [{
						_file: release.versions[0].files[0].file.id,
						flavor: { orientation: 'any', lighting: 'day' }
					}]
				})
				.then(res => res.expectStatus(200));
			const rotatedPlayfieldImage = res.data.files[0].playfield_image;
			expect(playfieldImage.metadata.size.height).to.be(rotatedPlayfieldImage.metadata.size.width);
			expect(playfieldImage.metadata.size.width).to.be(rotatedPlayfieldImage.metadata.size.height);
		});

		it('should fail when rotating not a playfield image', async () => {
			const user = 'member';
			const release = await api.releaseHelper.createRelease(user);
			await api.as(user)
				.withQuery({ rotate: release.versions[0].files[0].file.id + ':90' })
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, {
					files: [{
						_file: release.versions[0].files[0].file.id,
						flavor: { orientation: 'ws' }
					}]
				})
				.then(res => res.expectError(400, 'can only rotate images'));
		});

		it('should fail when rotating playfield that does not belong to the version', async () => {
			let user = 'member';
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', 'playfield');
			const release = await api.releaseHelper.createRelease(user);
			await api.as('member')
				.withQuery({ rotate: playfield.id + ':90' })
				.patch('/v1/releases/' + release.id  + '/versions/' + release.versions[0].version, {})
				.then(res => res.expectError(400, 'it is not part of the release'));
		});

		it('should succeed when logged as non-creator but author', async () => {
			const user = 'member';
			const newChanges = 'New changes.';
			const release = await api.releaseHelper.createRelease(user);
			const originalAuthors = release.authors.map(a => { return { _user: a.user.id, roles: a.roles };});
			await api.as(user)
				.patch('/v1/releases/' + release.id,
					{ authors: [ ...originalAuthors, { _user: api.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
				.then(res => res.expectStatus(200));
			res = await api.as('othermember')
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, { changes: newChanges})
				.then(res => res.expectStatus(200));
			const version = res.data;
			expect(version).to.be.ok();
			expect(version.changes).to.be(newChanges);
		});

		it('should succeed when logged as non-creator but moderator', async () => {
			const user = 'member';
			const newChanges = 'New changes.';
			const release = await api.releaseHelper.createRelease(user);
			res = await api.as('moderator')
				.patch('/v1/releases/' + release.id + '/versions/' + release.versions[0].version, { changes: newChanges})
				.then(res => res.expectStatus(200));
			const version = res.data;
			expect(version).to.be.ok();
			expect(version.changes).to.be(newChanges);
		});
	});
});
