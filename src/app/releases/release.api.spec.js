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
const shortId = require('shortid32');
const faker = require('faker');
const { filter } = require('lodash');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `Release` API', () => {

	describe('when creating a new release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] },
			});
		});

		after(async () => await api.teardown());

		it('should fail validations for empty release', async () => {
			await api.as('member')
				.post('/v1/releases', {})
				.then(res => res.expectValidationErrors([
					[ '_game', 'must be provided' ],
					[ 'name', 'must be provided' ],
					[ 'versions', 'at least one version' ],
					[ 'authors', 'at least one author' ],
				]));
		});

		it('should fail validations for empty version', async () => {
			await api.as('member')
				.post('/v1/releases', { versions: [ { } ] })
				.then(res => res.expectValidationErrors([
					[ 'versions.0.version', 'must be provided' ],
					[ 'versions.0.files', 'at least one' ],
				]));
		});

		it('should fail validations for empty file', async () => {
			await api.as('member')
				.post('/v1/releases', { versions: [ { files: [ { } ] } ] })
				.then(res => res
					.expectValidationError('versions.0.files.0._file', 'must provide a file reference')
					.expectNoValidationError('versions.0.files.0.flavor.orientation')
					.expectNoValidationError('versions.0.files.0.flavor.lighting')
					.expectNoValidationError('versions.0.files.0._playfield_image')
				);
		});

		it('should fail validations when providing valid file reference with invalid meta data', async () => {
			const vptfile = await api.fileHelper.createVpt('member');
			res = await api
				.as('member')
				.saveResponse('releases/create')
				.post('/v1/releases', { versions: [ {
						files: [
							{ _file: vptfile.id },
							{ _file: vptfile.id, flavor: {} },
							{ _file: vptfile.id, flavor: { orientation: 'invalid' } },
							{ _file: vptfile.id },
							{ _file: vptfile.id, _compatibility: [ 'non-existent' ] }
						]
					} ] })
				.then(res => res.expectValidationErrors([
					[ 'versions', 'reference a file multiple times' ],
					[ 'versions.0.files.0.flavor.orientation', 'must be provided' ],
					[ 'versions.0.files.0.flavor.lighting', 'must be provided' ],
					[ 'versions.0.files.0._compatibility', 'must be provided' ],
					[ 'versions.0.files.1.flavor.orientation', 'must be provided' ],
					[ 'versions.0.files.1.flavor.lighting', 'must be provided' ],
					[ 'versions.0.files.2.flavor.orientation', 'invalid orientation' ],
					[ 'versions.0.files.3._compatibility', 'must be provided' ],
					[ 'versions.0.files.4._compatibility.0', 'no such build' ],
					[ 'versions.0.files.0._playfield_image', 'must be provided' ],
				]));
		});

		it('should fail validations when providing a non-existing file reference', async () => {
			await api.as('member')
				.post('/v1/releases', { versions: [ { files: [ { _file: 'non-existent' } ] } ] })
				.then(res => res.expectValidationError('versions.0.files.0._file', 'no such file'));
		});

		it('should fail validations when providing invalid tag references', async () => {
			res = await api.as('member')
				.post('/v1/releases', { _tags: [ 'dof', 'non-existent' ] })
				.then(res => res.expectValidationError('_tags.1', 'no such tag'));
		});

		it('should fail validations when providing the same flavor/compat combination more than once.');

		it('should fail accordingly when providing only non-table files', async () => {
			const textfile1 = await api.fileHelper.createTextfile('member');
			const textfile2 = await api.fileHelper.createTextfile('member');
			const vptfile = await api.fileHelper.createVpt('member');
			await api.as('member')
				.post('/v1/releases', {
					versions: [{
						files: [
							{ _file: textfile1.id },
							{ _file: vptfile.id }
						]
					}, {
						files: [
							{ _file: textfile2.id }
						]
					}]
				})
				.then(res => res
					.expectValidationError('versions.1.files', 'at least one table file')
					.expectNoValidationError('versions.1.files.0.flavor.orientation', 'must be provided')
					.expectNoValidationError('versions.1.files.0.flavor.lighting', 'must be provided')
					.expectNoValidationError('versions.1.files.0._playfield_image', 'must be provided')
				);
		});

		it('should fail validations when providing a different file type as playfield image', async () => {
			const user = 'member';
			const vptfile = await api.fileHelper.createVpt(user);
			const data = await api.imageHelper.createPng(1080, 1920);
			res = await api.onStorage().as(user)
				.markTeardown()
				.withQuery({ type: 'backglass' })
				.withContentType('image/png')
				.withHeader('Content-Disposition', 'attachment; filename="wrontype.png"')
				.withHeader('Content-Length', data.length)
				.post('/v1/files', data)
				.then(res => res.expectStatus(201));

			const playfieldId = res.data.id;
			await api
				.as(user)
				.post('/v1/releases', {
					versions: [{
						files: [{
							_file: vptfile.id,
							_playfield_image: playfieldId
						}]
					}]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'file_type "playfield-fs" or "playfield-ws"'));
		});

		it('should fail validations when providing a playfield image with the wrong aspect ratio', async () => {
			const user = 'member';
			const vptfile = await api.fileHelper.createVpt(user);
			const backglass = await api.fileHelper.createBackglass(user);
			await api.as(user)
				.post('/v1/releases', {
					versions: [ {
						files: [ {
							_file: vptfile.id,
							_playfield_image: backglass.id
						} ]
					} ]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'have an aspect ratio between'));
		});

		it('should fail when providing the same build twice', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user);
			const playfield = await api.fileHelper.createPlayfield(user, 'fs');
			await api.as(user)
				.post('/v1/releases', {
					name: 'release',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0', '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectValidationError('versions.0.files.0._compatibility', 'multiple times'));
		});

		it('should fail validations when providing a different file type as playfield video');
		it('should fail validations when providing a non-existent build');
		it('should fail validations when providing a non-existent playfield video');

		it('should succeed when providing minimal data', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user);
			const playfield = await api.fileHelper.createPlayfield(user, 'fs');
			await api.as(user)
				.markTeardown()
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectStatus(201));
		});

		it('should succeed when providing full data', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfiles = await api.fileHelper.createVpts(user, 2);
			const playfieldImages = await api.fileHelper.createPlayfields(user, 'fs', 2);
			const playfieldVideo = await api.fileHelper.createMp4(user);
			const mp3 = await api.fileHelper.createMp3(user);
			res = await api.as(user)
				.markTeardown()
				.save('releases/create')
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfiles[0].id,
								_playfield_image: playfieldImages[0].id,
								_playfield_video: playfieldVideo.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' }

							}, {
								_file: vptfiles[1].id,
								_playfield_image: playfieldImages[1].id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'day' }
							}, {
								_file: mp3.id
							} ],
							version: '1.0.0',
							released_at: '2015-08-01T00:00:00.000Z'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ],
					_tags: [ 'hd', 'dof' ]
				})
				.then(res => res.expectStatus(201));

			expect(res.data.versions[0].files[0].playfield_image.is_active).to.be(true);
			expect(res.data.versions[0].files[0].playfield_video.is_active).to.be(true);
			expect(res.data.versions[0].files[1].playfield_image.is_active).to.be(true);
		});

		it('should correctly inherit release date if set', async () => {
			const user = 'member';
			const date1 = '2015-01-01T00:00:00.000Z';
			const date2 = '2015-08-01T00:00:00.000Z';

			const game = await api.gameHelper.createGame('moderator');
			const vptfiles = await api.fileHelper.createVpts(user, 2);
			const playfieldImages = await api.fileHelper.createPlayfields(user, 'fs', 2);

			res = await api.as(user)
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								released_at: date1,
								_file: vptfiles[0].id,
								_playfield_image: playfieldImages[0].id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' }

							}, {
								_file: vptfiles[1].id,
								_playfield_image: playfieldImages[1].id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'day' }
							} ],
							version: '1.0.0',
							released_at: date2
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ],
					_tags: [ 'hd', 'dof' ]
				})
				.then(res => res.expectStatus(201));

			expect(res.data.versions[0].released_at).to.be(date2);
			expect(res.data.versions[0].files[0].released_at).to.be(date1);
			expect(res.data.versions[0].files[1].released_at).to.be(date2);
		});

		it('should succeed using a fs playfield for universal orientation', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user, { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', 'playfield', { keep: true });
			expect(playfield.metadata.size.width).to.be(1080);
			expect(playfield.metadata.size.height).to.be(1920);

			res = await api.as(user)
				.withQuery({ rotate: playfield.id + ':0' })
				.markTeardown()
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'any', lighting: 'any' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectStatus(201));
			let playfieldRelease = res.data.versions[0].files[0].playfield_image;
			expect(playfieldRelease.metadata.size.width).to.be(1080);
			expect(playfieldRelease.metadata.size.height).to.be(1920);

			res = await api
				.responseAsBuffer()
				.getAbsolute(playfieldRelease.variations.medium.url)
				.then(res => res.expectStatus(200));
			const img = await api.imageHelper.metadata(res);
			expect(img.width).to.be.lessThan(img.height);
		});

		it('should succeed when rotating a ws playfield to a fs file', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user, { keep: true });
			const playfield = await api.fileHelper.createPlayfield(user, 'ws', 'playfield', { keep: true });

			expect(playfield.metadata.size.width).to.be(1920);
			expect(playfield.metadata.size.height).to.be(1080);

			res = await api.as(user)
				.markTeardown()
				.withQuery({ rotate: playfield.id + ':90' })
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lighting: 'night' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectStatus(201));

			let playfieldRotated = res.data.versions[0].files[0].playfield_image;
			expect(playfieldRotated.metadata.size.width).to.be(1080);
			expect(playfieldRotated.metadata.size.height).to.be(1920);

			res = await api
				.responseAsBuffer()
				.getAbsolute(playfieldRotated.variations.full.url)
				.then(res => res.expectStatus(200));
			const img = await api.imageHelper.metadata(res);
			expect(img.width).to.be(1080);
			expect(img.height).to.be(1920);
		});

		it('should succeed when rotating a fs playfield to a ws file', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user);
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', 'playfield');

			res = await api.as(user)
				.markTeardown()
				.withQuery({ rotate: playfield.id + ':90' })
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'ws', lighting: 'night' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectStatus(201));

			let playfieldRotated = res.data.versions[0].files[0].playfield_image;
			expect(playfield.metadata.size.width).to.be(playfieldRotated.metadata.size.height);
			expect(playfield.metadata.size.height).to.be(playfieldRotated.metadata.size.width);
		});

		it('should fail when rotating playfield not belonging to the release', async () => {
			const user = 'member';
			const game = await api.gameHelper.createGame('moderator');
			const vptfile = await api.fileHelper.createVpt(user);
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', 'playfield');
			const playfieldOther = await api.fileHelper.createPlayfield(user, 'fs', 'playfield');
			await api.as(user)
				.withQuery({ rotate: playfieldOther.id + ':90' })
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'ws', lighting: 'night' } }
							],
							version: '1.0.0'
						}
					],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectError(400, 'it is not part of the release'));
		});

		it('should properly increment counters of a release with multiple versions', async () => {

			const user = 'contributor';
			const game = await api.gameHelper.createGame('moderator');
			const vptfiles = await api.fileHelper.createVpts(user, 2, { keep: true });
			const playfields = await api.fileHelper.createPlayfields(user, 'fs', 2, undefined, { keep: true });
			res = await api.as(user)
				.markTeardown()
				.post('/v1/releases', {
					name: faker.company.catchPhraseAdjective() + ' Edition',
					license: 'by-sa',
					_game: game.id,
					versions: [
						{
							files: [ {
								_file: vptfiles[0].id,
								_playfield_image: playfields[0].id,
								_compatibility: [ '10.x' ],
								flavor: { orientation: 'fs', lighting: 'night' }
							} ],
							version: '2.0',
							"released_at": "2015-08-30T12:00:00.000Z"
						}, {
							files: [ {
								_file: vptfiles[1].id,
								_playfield_image: playfields[1].id,
								_compatibility: [ '10.x' ],
								flavor: { orientation: 'fs', lighting: 'night' }
							} ],
							version: '1.0',
							"released_at": "2015-07-01T12:00:00.000Z"
						}
					],
					_tags: ['wip', 'dof'],
					authors: [ { _user: api.getUser(user).id, roles: [ 'Table Creator' ] } ]
				})
				.then(res => res.expectStatus(201));
			const release = res.data;
			expect(release.versions[0].files[0].counter.downloads).to.be(0);
			expect(release.versions[1].files[0].counter.downloads).to.be(0);

			const body = {
				files: [release.versions[1].files[0].file.id],
				media: { playfield_image: false, playfield_video: false }
			};

			await api
				.onStorage()
				.as(user)
				.withQuery(({ body: JSON.stringify(body) }))
				.withHeader('Accept', 'application/zip')
				.responseAsBuffer()
				.get('/v1/releases/' + release.id)
				.then(res => res.expectStatus(200));

			res = await api.get(`/v1/releases/${release.id}`).then(res => res.expectStatus(200));
			expect(res.data.versions[0].files[0].counter.downloads).to.be(0);
			expect(res.data.versions[1].files[0].counter.downloads).to.be(1);
		});

		it('should fail when providing a non-rotated and unspecified playfield image ("playfield" file_type)');

		it('should activate tags and builds if created');

	});

	describe('when updating an existing release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
		});

		after(async () => await api.teardown());

		it('should fail if not author or creator', async () => {
			const release = await api.releaseHelper.createRelease('member');
			await api.as('othermember')
				.patch('/v1/releases/' + release.id, { name: 'New name' })
				.then(res => res.expectError(403));
		});

		it('should fail if an invalid release ID is provided', async () => {
			res = await api.as('member')
				.patch('/v1/releases/non-existent', {})
				.then(res => res.expectError(404, 'no such release'));
		});

		it('should fail if an illegal attribute is provided', async () => {
			const release = await api.releaseHelper.createRelease('member');
			await api.as('member')
				.patch('/v1/releases/' + release.id, { id: '1234', name: 'New name', versions: [] })
				.then(res => res.expectError(400, 'invalid field'));
		});

		it('should fail validations for illegal data', async () => {
			const release = await api.releaseHelper.createRelease('member');
			await api.as('member')
				.patch('/v1/releases/' + release.id,
					{ name: '', authors: 'i am a string but i should not!', links: 'i am also string!' })
				.then(res => res.expectValidationErrors([
					['name', 'must be provided'],
					['authors', 'cast to array failed'],
					['links', 'cast to array failed'],
				]));
		});

		it('should succeed when updating text fields', async () => {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('member')
				.patch('/v1/releases/' + release.id,
					{ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
				.then(res => res.expectStatus(200));
			expect(res.data.name).to.be(newName);
			expect(res.data.description).to.be(newDescription);
			expect(res.data.acknowledgements).to.be(newAcknowledgements);
		});

		it('should succeed when updating all fields', async () => {
			const newName = 'Updated name';
			const newDescription = 'Updated description';
			const newAcknowledgements = 'Updated acknowledgements';
			const links = [
				{ label: 'first link', url: 'https://vpdb.io/somelink' },
				{ label: 'second link', url: 'https://vpdb.io/someotherlink' }
			];
			const newTags = ['hd', 'dof'];
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('member')
				.save('releases/update')
				.patch('/v1/releases/' + release.id, {
					name: newName,
					description: newDescription,
					acknowledgements: newAcknowledgements,
					authors: [ { _user: api.getUser('othermember').id, roles: [ 'Some other job' ] } ],
					links: links,
					_tags: newTags
				})
				.then(res => res.expectStatus(200));

			expect(res.data.name).to.be(newName);
			expect(res.data.description).to.be(newDescription);
			expect(res.data.acknowledgements).to.be(newAcknowledgements);
			expect(res.data.links).to.eql(links);
			expect(res.data.tags).to.be.an('array');
			expect(res.data.tags).to.have.length(newTags.length);
			newTags.forEach(tag => expect(res.data.tags.find(t => t.id === tag)).to.be.an('object'));
			expect(res.data.authors).to.have.length(1);
			expect(res.data.authors[0].user.id).to.be(api.getUser('othermember').id);
		});

		it('should succeed updating as non-creator but author', async () => {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			const release = await api.releaseHelper.createRelease('member');
			let originalAuthors = release.authors.map(a => ({ _user: a.user.id, roles: a.roles }));
			await api.as('member')
				.patch('/v1/releases/' + release.id,
					{ authors: [ ...originalAuthors, { _user: api.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
				.then(res => res.expectStatus(200));

			res = await api.as('othermember')
				.patch('/v1/releases/' + release.id,
					{ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
				.then(res => res.expectStatus(200));
			expect(res.data.name).to.be(newName);
			expect(res.data.description).to.be(newDescription);
			expect(res.data.acknowledgements).to.be(newAcknowledgements);
		});

		it('should succeed updating as non-creator but moderator', async () => {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('moderator')
				.patch('/v1/releases/' + release.id,
					{ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
				.then(res => res.expectStatus(200));
			expect(res.data.name).to.be(newName);
			expect(res.data.description).to.be(newDescription);
			expect(res.data.acknowledgements).to.be(newAcknowledgements);
		});

		it('should fail for a non-existing tag', async () => {
			const newTags = ['hd', 'i-dont-exist'];
			const release = await api.releaseHelper.createRelease('member');
			await api.as('member')
				.patch('/v1/releases/' + release.id, { _tags: newTags })
				.then(res => res.expectValidationError('_tags.1', 'no such tag'));
		});

		it('should succeed when updating tags', async () => {
			const newTags = ['hd', 'dof'];
			const release = await api.releaseHelper.createRelease('member');
				res = await api.as('member')
					.patch('/v1/releases/' + release.id, { _tags: newTags })
					.then(res => res.expectStatus(200));
				expect(res.data.tags).to.be.an('array');
				expect(res.data.tags).to.have.length(newTags.length);
				newTags.forEach(tag => expect(res.data.tags.find(t => t.id === tag)).to.be.an('object'));
		});

		it('should succeed when updating links', async () => {
			const links = [
				{ label: 'first link', url: 'https://vpdb.io/somelink' },
				{ label: 'second link', url: 'https://vpdb.io/someotherlink' }
			];
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('member')
				.patch('/v1/releases/' + release.id, { links: links })
				.then(res => res.expectStatus(200));
			expect(res.data.links).to.eql(links);
		});

		it('should fail when updating author as non-creator but other author', async () => {
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('member')
				.patch('/v1/releases/' + release.id,
					{ authors: [ { _user: api.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
				.then(res => res.expectStatus(200));
			res = await api.as('othermember')
				.patch('/v1/releases/' + release.id, { authors: [] })
				.then(res => res.expectError(403, 'only the original uploader'));
		});

		it('should succeed when updating authors', async () => {
			const release = await api.releaseHelper.createRelease('member');
				res = await api.as('member')
					.patch('/v1/releases/' + release.id,
						{ authors: [ { _user: api.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.then(res => res.expectStatus(200));
			expect(res.data.authors).to.have.length(1);
			expect(res.data.authors[0].user.id).to.be(api.getUser('othermember').id);
		});

	});

	describe('when viewing a release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			});
		});

		after(async () => await api.teardown());

		it('should list all fields', async () => {
			const release = await api.releaseHelper.createRelease('contributor');
			res = await api
				.get('/v1/releases/' + release.id)
				.then(res => res.expectStatus(200));
			const createdRelease = res.data;
			expect(res.data).to.be.an('object');
			expect(createdRelease.id).to.be.ok();
			expect(createdRelease.name).to.be.ok();
			expect(createdRelease.created_at).to.be.ok();
			expect(createdRelease.authors).to.be.an('array');
			expect(createdRelease.authors[0]).to.be.an('object');
			expect(createdRelease.authors[0].roles).to.be.an('array');
			expect(createdRelease.authors[0].user).to.be.an('object');
			expect(createdRelease.authors[0].user.id).to.be.ok();
			expect(createdRelease.authors[0].user.name).to.be.ok();
			expect(createdRelease.authors[0].user.username).to.be.ok();
			expect(createdRelease.thumb).to.not.be.ok();
		});

		it('should include thumb if format is given', async () => {
			const release = await api.releaseHelper.createRelease('contributor');
			res = await api
				.save('releases/view')
				.get('/v1/releases/' + release.id + '?thumb_format=square')
				.then(res => res.expectStatus(200));
			const createdRelease = res.data;
			expect(res.data).to.be.an('object');
			expect(createdRelease.id).to.be.ok();
			expect(createdRelease.name).to.be.ok();
			expect(createdRelease.thumb).to.be.an('object');
			expect(createdRelease.thumb.image).to.be.an('object');
			expect(createdRelease.thumb.image.url).to.contain('/square/');
		});

		it('should include thumb if flavor is given', async () => {
			const release = await api.releaseHelper.createRelease('contributor');
			res = await api
				.save('releases/view')
				.get('/v1/releases/' + release.id + '?thumb_flavor=orientation:fs')
				.then(res => res.expectStatus(200));

			const createdRelease = res.data;
			expect(res.data).to.be.an('object');
			expect(createdRelease.id).to.be.ok();
			expect(createdRelease.name).to.be.ok();
			expect(createdRelease.thumb).to.be.an('object');
			expect(createdRelease.thumb.flavor).to.be.an('object');
			expect(createdRelease.thumb.flavor.orientation).to.be('fs');
		});
	});

	describe('when listing releases', () => {

		const numReleases = 4;
		let releases;

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				providerUser: { roles: [ 'contributor' ] },
				moderator: { roles: [ 'moderator', 'contributor' ] },
				admin: { roles: [ 'admin' ] }
			});
			releases = await api.releaseHelper.createReleases('moderator',numReleases - 1);
			await api
				.post('/v1/authenticate/mock', {
					provider: 'github',
					profile: {
						provider: 'github',
						id: '11234',
						displayName: 'Motörhead Dude-23',
						username: 'motorhead',
						profileUrl: 'https://github.com/mockuser',
						emails: [
							{ value: api.getUser('providerUser').email }
						],
						_raw: '(not mocked)', _json: { not: 'mocked ' }
					}
				})
				.then(res => res.expectStatus(200));

			releases.push(await api.releaseHelper.createRelease4('providerUser'));
		});

		after(async () => await api.teardown());

		it('should list all fields', async () => {
			res = await api
				.get('/v1/releases')
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data).to.have.length(numReleases);

			for (const release of res.data) {
				expect(release.id).to.be.ok();
				expect(release.name).to.be.ok();
				expect(release.created_at).to.be.ok();
				expect(release.authors).to.be.an('array');
				expect(release.authors[0]).to.be.an('object');
				expect(release.authors[0].roles).to.be.an('array');
				expect(release.authors[0].user).to.be.an('object');
				expect(release.authors[0].user.id).to.be.ok();
				expect(release.authors[0].user.name).to.be.ok();
				expect(release.authors[0].user.username).to.be.ok();
				expect(release.authors[0]._user).to.not.be.ok();
			}
		});

		it('should fail when listing moderation fields as anonymous', async () => {
			await api
				.withQuery({ fields: 'moderation' })
				.get('/v1/releases')
				.then(res => res.expectError(403, 'must be logged in order to fetch moderation fields'));
		});

		it('should fail when listing moderation fields as non-moderator', async () => {
			await api.as('member')
				.withQuery({ fields: 'moderation' })
				.get('/v1/releases')
				.then(res => res.expectError(403, 'must be moderator in order to fetch moderation fields'));
		});

		it('should list moderation fields as moderator', async () => {
			res = await api.as('moderator')
				.withQuery({ fields: 'moderation' })
				.get('/v1/releases')
				.then(res => res.expectStatus(200));
			expect(res.data[0].moderation).to.be.ok();
		});

		it('should return the nearest thumb match of widescreen/night', async () => {
			res = await api
				.get('/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night')
				.then(res => res.expectStatus(200));

			const rls1 = res.data.find(r => r.id === releases[0].id);
			const rls2 = res.data.find(r => r.id === releases[1].id);
			const rls3 = res.data.find(r => r.id === releases[2].id);

			expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.url);
			expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].playfield_image.url);
			expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.url);
		});

		it('should return the nearest thumb match of widescreen/night in the correct format', async () => {
			res = await api
				.get('/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night&thumb_format=medium')
				.then(res => res.expectStatus(200));

			const rls1 = res.data.find(r => r.id === releases[0].id);
			const rls2 = res.data.find(r => r.id === releases[1].id);
			const rls3 = res.data.find(r => r.id === releases[2].id);

			expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.variations.medium.url);
			expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].playfield_image.variations.medium.url);
			expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.variations.medium.url);
		});

		it('should return the nearest thumb match of night/widescreen', async () => {
			res = await api
				.get('/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.then(res => res.expectStatus(200));

			const rls1 = res.data.find(r => r.id === releases[0].id);
			const rls2 = res.data.find(r => r.id === releases[1].id);
			const rls3 = res.data.find(r => r.id === releases[2].id);

			expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.url);
			expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[0].playfield_image.url);
			expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.url);
		});

		it('should return the a thumb of an older version if the newer version has no such thumb', async () => {
			res = await api
				.get('/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.then(res => res.expectStatus(200));

			const rls4 = res.data.find(r => r.id === releases[3].id);
			expect(rls4.thumb.image.url).to.be(releases[3].versions[1].files[0].playfield_image.url);
		});

		it('should return square thumb format', async () => {
			res = await api
				.save('releases/list')
				.get('/v1/releases?thumb_format=square')
				.then(res => res.expectStatus(200));
			for (let i = 0; i < numReleases; i++) {
				expect(res.data[i].thumb.image.url).to.contain('/square/');
			}
		});

		it('should deny access to starred releases when not logged', async () => {
			await api
				.saveResponse('releases/list')
				.get('/v1/releases?starred')
				.then(res => res.expectError(401));
		});

		it('should list only starred releases', async () => {

			res = await api.as('member').get('/v1/releases?starred').then(res => res.expectStatus(200));
			expect(res.data).to.be.empty();

			await api.as('member')
				.post(`/v1/releases/${releases[0].id}/star`, {})
				.then(res => res.expectStatus(201));

			res = await api.as('member').get('/v1/releases?starred').then(res => res.expectStatus(200));
			expect(res.data).to.have.length(1);
			expect(res.data[0].id).to.be(releases[0].id);

			res = await api.as('member').get('/v1/releases?starred=false').then(res => res.expectStatus(200));
			expect(res.data).to.have.length(numReleases - 1);
			expect(res.data[0].id).not.to.be(releases[0].id);
			expect(res.data[1].id).not.to.be(releases[0].id);
		});

		it('should list only releases for given IDs', async () => {
			const ids = [releases[0].id, releases[1].id];
			res = await api.get('/v1/releases?ids=' + ids.join(',')).then(res => res.expectStatus(200));

			expect(res.data).to.have.length(ids.length);
			expect(res.data.find(r => r.id === releases[0].id)).to.be.ok();
			expect(res.data.find(r => r.id === releases[1].id)).to.be.ok();
		});

		it('should list only tagged releases', async () => {
			const tags = ['dof'];
			res = await api.get('/v1/releases?tags=' + tags.join(',')).then(res => res.expectStatus(200));

			const tagFilter = tags.map(tag => ({ id: tag }));
			const taggedReleases = filter(releases, { tags: tagFilter });
			expect(res.data).to.have.length(taggedReleases.length);
			for (let i = 0; i < taggedReleases.length; i++) {
				expect(res.data.find(r => r.id === taggedReleases[i].id)).to.be.ok();
			}
		});

		it('should list only tagged releases for multiple tags', async () => {
			const tags = ['dof', 'wip'];
			res = await api.get('/v1/releases?tags=' + tags.join(',')).then(res => res.expectStatus(200));
			const tagFilter = tags.map(tag => ({ id: tag }));
			const taggedReleases = filter(releases, { tags: tagFilter });
			expect(res.data).to.have.length(taggedReleases.length);
			for (let i = 0; i < taggedReleases.length; i++) {
				expect(res.data.find(r => r.id === taggedReleases[i].id)).to.be.ok();
			}
		});

		it('should list only releases whose name matches a query', async () => {

			res = await api.get('/v1/releases?q=' + releases[1].name).then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === releases[1].id)).to.be.ok();
		});

		it('should list only releases whose game title matches a query', async () => {

			res = await api.get('/v1/releases?q=' + releases[1].game.title).then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === releases[1].id)).to.be.ok();
		});

		it('should fail for queries less than 3 characters', async () => {
			await api.get('/v1/releases?q=12').then(res => res.expectError(400));
		});

		it('should succeed for queries more than 2 character', async () => {

			res = await api.get('/v1/releases?q=' + releases[1].name.substr(0, 3)).then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === releases[1].id)).to.be.ok();
		});

		it('should list only a given flavor', async () => {

			res = await api.get('/v1/releases?flavor=orientation:ws').then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === releases[0].id)).to.not.be.ok();
			expect(res.data.find(r => r.id === releases[1].id)).to.be.ok();
			expect(res.data.find(r => r.id === releases[2].id)).to.be.ok();
		});

		it('should list only releases for a given build', async () => {

			const builds = ['10.x'];
			res = await api.get('/v1/releases?builds=' + builds.join(',')).then(res => res.expectStatus(200));

			let filteredReleases = [];
			for (const build of builds) {
				filteredReleases = filteredReleases.concat(filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
			}
			expect(res.data).to.have.length(filteredReleases.length);
			for (let i = 0; i < filteredReleases.length; i++) {
				expect(res.data.find(r => r.id === filteredReleases[i].id)).to.be.ok();
			}
		});

		it('should list only releases for multiple builds', async () => {

			const builds = ['10.x', 'physmod5'];
			res = await api.get('/v1/releases?builds=' + builds.join(',')).then(res => res.expectStatus(200));

			let filteredReleases = [];
			for (const build of builds) {
				filteredReleases = filteredReleases.concat(filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
			}
			expect(res.data).to.have.length(filteredReleases.length);
			for (let i = 0; i < filteredReleases.length; i++) {
				expect(res.data.find(r => r.id === filteredReleases[i].id)).to.be.ok();
			}
		});

		it('should contain a thumb field per file if requested', async () => {
			res = await api.get('/v1/releases?thumb_format=square&thumb_per_file=true').then(res => res.expectStatus(200));
			for (let i = 0; i < res.data.length; i++) {
				expect(res.data[i].versions[0].files[0].thumb).to.be.an('object');
				expect(res.data[i].versions[0].files[0].thumb.url).to.contain('/square/');
			}
		});

		it('should refuse thumb field per file if no format is given', async () => {
			await api.get('/v1/releases?thumb_per_file=true').then(res => res.expectError(400, 'must specify "thumb_format"'));
		});

		it('should fail when filtering by provider without provider token', async () => {
			res = await api
				.withQuery({ provider_user: '1234' })
				.get('/v1/releases')
				.then(res => res.expectError(400, 'Must be authenticated with provider token'));
		});

		it('should succeed filtering by user provider id', async () => {
			res = await api.as('admin')
				.post('/v1/tokens',
					{ label: 'Test Application', password: api.getUser('admin').password, provider: 'github', type: 'provider', scopes: [ 'community'] })
				.then(res => res.expectStatus(201));

			const token = res.data.token;
			res = await api
				.withToken(token)
				.withQuery({ provider_user: '11234' })
				.get('/v1/releases')
				.then(res => res.expectStatus(200));
			expect(res.data.length).to.be(1);
			expect(res.data[0].id).to.be(releases[3].id);
		});

		it('should only list releases with table files of a given size');
		it('should only list releases with table files of a given size and threshold');

	});

	describe('when only listing "mine"', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				author: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'release-contributor' ] },
			});
		});

		after(async () => await api.teardown());

		it('should list restricted releases', async () => {
			const restrictedGame = await api.gameHelper.createGame('moderator', { ipdb: { number: 99999, mpu: 9999 } });
			const release = await api.releaseHelper.createReleaseForGame('contributor', restrictedGame);
			res = await api.as('contributor')
				.get('/v1/releases?show_mine_only=1')
				.then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === release.id)).to.be.ok();
		});

		it('should list pending releases as uploader', async () => {
			const release = await api.releaseHelper.createRelease('member');
			res = await api.as('member')
				.get('/v1/releases?show_mine_only=1')
				.then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === release.id)).to.be.ok();
		});

		it('should list pending releases as author', async () => {
			const release = await api.releaseHelper.createRelease('member', { author: 'author' });
			res = await api.as('author')
				.get('/v1/releases?show_mine_only=1')
				.then(res => res.expectStatus(200));
			expect(res.data.find(r => r.id === release.id)).to.be.ok();
		});

	});

});
