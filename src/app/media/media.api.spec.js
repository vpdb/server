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
const ApiClient = require('../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `Media` API', () => {

	describe('when posting media', () => {

		let backglass;

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			});
			backglass = await api.fileHelper.createBackglass('member');
		});

		after(async () => await api.teardown());

		it('should fail for empty data', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', {})
				.then(res => res.expectNumValidationErrors(2).expectValidationErrors([
					[ '_file', 'must provide a file reference' ],
					[ 'category', 'must provide a category' ],
				]));
		});

		it('should fail when providing invalid data', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'flütz', _file: 'brögl', _ref: { game: 'bitzü' } })
				.then(res => res.expectNumValidationErrors(3).expectValidationErrors([
					['_file', 'no such file'],
					['_ref.game', 'no such game'],
					['category', 'invalid category'],
				]));
		});

		it('should fail when providing incomplete category (no child)', async () => {
			const user = 'member';
			await api.as(user)
				.saveResponse('media/create')
				.post('/v1/media', { category: 'flyer_image' })
				.then(res => res.expectValidationError( 'category', 'must provide sub-category'));
		});

		it('should fail when providing an incomplete category (no variation)', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'playfield_image' })
				.then(res => res.expectValidationError('category', 'must provide sub-category'));
		});

		it('should fail when providing an invalid sub-category (variation)', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'playfield_image/grützl' })
				.then(res => res.expectValidationError('category', 'invalid sub-category'));
		});

		it('should fail when providing an invalid sub-category (child)', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'flyer_image/grützl' })
				.then(res => res.expectValidationError('category', 'invalid sub-category'));
		});

		it('should fail when no reference for a valid category is provided', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'backglass_image' })
				.then(res => res.expectValidationError('_ref', 'reference to game missing'));
		});

		it('should fail when the referenced file has an invalid mime type', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'backglass_video', _file: backglass.id })
				.then(res => res.expectValidationError('_file', 'invalid mime type'));
		});

		it('should fail when the referenced file has an invalid file type', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'wheel_image', _file: backglass.id })
				.then(res => res.expectValidationError('_file', 'invalid file type'));
		});

		it('should fail when the referenced file has an invalid file type of a variation', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/media', { category: 'playfield_image/fs', _file: backglass.id })
				.then(res => res.expectValidationError('_file', 'invalid file type'));
		});

		it('should succeed for minimal data', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user, { keep: true });
			const game = await api.gameHelper.createGame('moderator');
			res = await api.as(user)
				.post('/v1/media', {
					category: 'backglass_image',
					_file: bg.id,
					_ref: { game: game.id }
				})
				.then(res => res.expectStatus(201));
			expect(res.data.game).to.be.an('object');
			expect(res.data.category).to.be('backglass_image');
			expect(res.data.created_by).to.be.an('object');
		});

		it('should succeed for full data', async () => {
			const user = 'member';
			const description = 'This is a very super high resolution backglass that I have stitched together from four different sources.';
			const acknowledgements = '- Thanks to @mom for all her patience';
			const bg = await api.fileHelper.createBackglass(user, { keep: true });
			const game = await api.gameHelper.createGame('moderator');
			res = await api.as(user)
				.save('media/create')
				.post('/v1/media', {
					description: description,
					acknowledgements: acknowledgements,
					category: 'backglass_image',
					_file: bg.id,
					_ref: { game: game.id }
				})
				.then(res => res.expectStatus(201));
			expect(res.data.game).to.be.an('object');
			expect(res.data.description).to.be(description);
			expect(res.data.acknowledgements).to.be(acknowledgements);
			expect(res.data.category).to.be('backglass_image');
			expect(res.data.created_by).to.be.an('object');
		});
	});

	describe('when listing media', () => {

		let backglass;

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			});
			backglass = await api.fileHelper.createBackglass('member');
		});

		after(async () => await api.teardown());

		it('should fail for an invalid game', async () => {
			await api.get('/v1/games/sabbelnich/media').then(res => res.expectError(404, 'unknown game'));
		});

		it('should list media under the game', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user, { keep: true });
			const game = await api.gameHelper.createGame('moderator');
			res = await api.as(user)
				.post('/v1/media', {
					category: 'backglass_image',
					_file: bg.id,
					_ref: { game: game.id }
				})
				.then(res => res.expectStatus(201));
			const media = res.data;
			res = await api
				.save('games/list-media')
				.get(`/v1/games/${game.id}/media`)
				.then(res => res.expectStatus(200));

			expect(res.data).to.be.an('array');
			expect(res.data).to.have.length(1);
			expect(res.data[0].id).to.be(media.id);
		});
	});

	describe('when deleting a medium', () => {

		let game;

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			});
			game = await api.gameHelper.createGame('moderator');
		});

		after(async () => await api.teardown());

		it('should fail if the medium does not exist', async () => {
			await api.as('moderator').del('/v1/media/1234').then(res => res.expectError(404, 'no such medium'));
		});

		it('should fail if the medium is owned by another member', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user);
			res = await api.as(user)
				.post('/v1/media', {
					_ref: { game: game.id },
					_file: bg.id,
					category: 'backglass_image'
				})
				.then(res => res.expectStatus(201));

			await api.as('member2')
				.saveResponse('media/del')
				.del(`/v1/media/${res.data.id}`)
				.then(res => res.expectError(403, 'must be owner'));
		});

		it('should fail if the medium is owned by another contributor', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user);
			res = await api.as(user)
				.markTeardown()
				.post('/v1/media', {
					_ref: { game: game.id },
					_file: bg.id,
					category: 'backglass_image'
				})
				.then(res => res.expectStatus(201));

			await api.as('contributor')
				.del(`/v1/media/${res.data.id}`)
				.then(res => res.expectError(403, 'must be owner'));
		});

		it('should succeed if the backglass is owned', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user);
			res = await api.as(user)
				.post('/v1/media', {
					_ref: { game: game.id },
					_file: bg.id,
					category: 'backglass_image'
				})
				.then(res => res.expectStatus(201));

			await api.as(user)
				.save('media/del')
				.del(`/v1/media/${res.data.id}`)
				.then(res => res.expectStatus(204));
		});

		it('should succeed as moderator', async () => {
			const user = 'member';
			const bg = await api.fileHelper.createBackglass(user);
			res = await api.as(user)
				.post('/v1/media', {
					_ref: { game: game.id },
					_file: bg.id,
					category: 'backglass_image'
				})
				.then(res => res.expectStatus(201));

			await api.as('moderator')
				.del(`/v1/media/${res.data.id}`)
				.then(res => res.expectStatus(204));
		});

		it('should invalidate the cache of game details', async () => {

		});

		it('should invalidate the cache of release details', async () => {

		});

	});
});

describe('When dealing with pre-processing media', () => {

	describe('of a release', () => {

		let game, vptfile;

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
			game = await api.gameHelper.createGame('moderator');
			vptfile = await api.fileHelper.createVpt('member');
		});

		after(async () => await api.teardown());

		it('should fail when providing a ws playfield for a fs file', async () => {
			const user = 'member';
			const playfield = await api.fileHelper.createPlayfield(user,  'ws');
			await api
				.as(user)
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [{
						files: [{
							_file: vptfile.id,
							_playfield_image: playfield.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'fs', lighting: 'night' }
						}],
						version: '1.0.0'
					}],
					authors: [{ _user: api.getUser(user).id, roles: ['Table Creator'] }]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'orientation is set to fs'));
		});

		it('should fail when providing a fs playfield for a ws file', async () => {
			const user = 'member';
			const playfield = await api.fileHelper.createPlayfield(user, 'fs');
			await api.as(user)
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [{
						files: [{
							_file: vptfile.id,
							_playfield_image: playfield.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'ws', lighting: 'night' }
						}],
						version: '1.0.0',
					}],
					authors: [{ _user: api.getUser(user).id, roles: ['Table Creator'] }]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'orientation is set to ws'));
		});

		it('should fail when image orientation for playfield-fs is ws', async () => {
			const user = 'member';
			const playfield = await api.fileHelper.createPlayfield(user, 'ws', 'playfield-fs');
			await apiq.as(user)
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [{
						files: [{
							_file: vptfile.id,
							_playfield_image: playfield.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'fs', lighting: 'night' }
						}],
						version: '1.0.0',
					}],
					authors: [{ _user: api.getUser(user).id, roles: ['Table Creator'] }]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'should be portrait'));
		});

		it('should fail when image orientation for playfield-ws is fs', async () => {
			const user = 'member';
			const playfield = await api.fileHelper.createPlayfield(user, 'fs', 'playfield-ws');
			await api.as(user)
				.post('/v1/releases', {
					name: 'release',
					license: 'by-sa',
					_game: game.id,
					versions: [{
						files: [{
							_file: vptfile.id,
							_playfield_image: playfield.id,
							_compatibility: ['9.9.0'],
							flavor: { orientation: 'ws', lighting: 'night' }
						}],
						version: '1.0.0'
					}],
					authors: [{ _user: api.getUser(user).id, roles: ['Table Creator'] }]
				})
				.then(res => res.expectValidationError('versions.0.files.0._playfield_image', 'should be landscape'));
		});

		it('should fail when providing incorrect rotation parameters', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/releases?rotate=foobar!', {})
				.then(res => res.expectError(400, "must be separated by"));
		});

		it('should fail when providing incorrect rotation angle', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/releases?rotate=foobar:45', {})
				.then(res => res.expectError(400, "wrong angle"));
		});

		it('should fail when trying to rotate a non-existing image', async () => {
			const user = 'member';
			await api.as(user)
				.post('/v1/releases?rotate=non-existent:90', {})
				.then(res => res.expectError(404, "non-existing file"));
		});

	});
});