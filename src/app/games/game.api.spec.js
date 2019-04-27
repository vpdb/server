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

const { sortBy } = require('lodash');
const expect = require('expect.js');

const ApiClient = require('../../test/api.client');

const api = new ApiClient();
let res;

describe('The VPDB `game` API', () => {

	describe('when posting a new recreation', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
		});

		after(async () => await api.teardown());

		it('should succeed if provided data is correct', async () => {
			const user = 'moderator';
			const backglass = await api.fileHelper.createBackglass(user, { keep: true });
			await api.as(user)
				.markTeardown()
				.save('games/create')
				.post('/v1/games', api.gameHelper.getGame({ _backglass: backglass.id }))
				.then(res => res.expectStatus(201));
		});

		it('should fail if the ipdb number is already in the database', async () => {
			const user = 'moderator';
			const game = await api.gameHelper.createGame(user);
			const backglass = await api.fileHelper.createBackglass(user);
			game._backglass = backglass.id;
			game.id = game.id + '-2';
			await api.as(user)
				.post('/v1/games', game)
				.then(res => res
					.expectValidationError('ipdb.number', 'cannot be added twice')
					.expectNumValidationErrors(1)
				);
		});

		it('should fail if the game id is already in the database', async () => {
			const user = 'moderator';
			const game = await api.gameHelper.createGame(user);
			const backglass = await api.fileHelper.createBackglass(user);
			const dupeId = game.id;
			const dupeGame = api.gameHelper.getGame({ _backglass: backglass.id });
			dupeGame.id = dupeId;
			await api.as(user)
				.post('/v1/games', dupeGame)
				.then(res => res
					.expectValidationError('id', 'is already taken')
					.expectNumValidationErrors(1)
				);
		});

		it('should fail if a referenced file is already referenced', async () => {
			const game = await api.gameHelper.createGame('moderator');
			const backglassId = game.backglass.id;
			await api.as('moderator')
				.post('/v1/games', api.gameHelper.getGame({ _backglass: backglassId }))
				.then(res => res
					.expectValidationError('_backglass', 'Cannot reference active files')
					.expectNumValidationErrors(1)
				);
		});

		it('should fail if the referenced file type for backglass is not a backglass.', async () => {
			const rom = await api.fileHelper.createRom('moderator');
			await api.as('moderator')
				.post('/v1/games', api.gameHelper.getGame({ _backglass: rom.id }))
				.then(res => res
					.expectValidationError('_backglass', 'file of type "backglass"')
					.expectNumValidationErrors(1)
				);
		});
	});

	describe('when posting a new original game', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
			});
		});

		after(async () => await api.teardown());

		it('should fail when not providing mandatory fields', async () => {
			await api.as('member')
				.post('/v1/games', { game_type: 'og' })
				.then(res => res.expectValidationErrors([
					['_backglass', 'Backglass image must be provided'],
					['manufacturer', 'Manufacturer must be provided'],
					['year', 'Year must be provided'],
					['title', 'Title must be provided'],
					['id', 'Game ID must be provided'],
				]));
		});

		it('should succeed when providing minimal data', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			res = await api.as('member')
				.markRootTeardown()
				.post('/v1/games', {
					game_type: 'og',
					_backglass: backglass.id,
					manufacturer: 'Test Inc.',
					year: 2019,
					title: 'Pinball play, you must',
					id: 'pbpym',
				})
				.then(res => res.expectStatus(201));
			expect(res.data.game_type).to.be('og');
			expect(res.data.backglass.id).to.be(backglass.id);
			expect(res.data.manufacturer).to.be('Test Inc.');
			expect(res.data.year).to.be(2019);
			expect(res.data.title).to.be('Pinball play, you must');
			expect(res.data.id).to.be('pbpym');
		});

		it('should succeed when providing full data', async () => {
			const backglass = await api.fileHelper.createBackglass('member');
			res = await api.as('member')
				.markRootTeardown()
				.post('/v1/games', {
					game_type: 'og',
					_backglass: backglass.id,
					manufacturer: 'Test Inc.',
					year: 2019,
					title: 'Pinball play, you must',
					id: 'pbpym2',
					description: 'A table you can play',
					instructions: 'Play pinball!',
				})
				.then(res => res.expectStatus(201));
			expect(res.data.game_type).to.be('og');
			expect(res.data.backglass.id).to.be(backglass.id);
			expect(res.data.manufacturer).to.be('Test Inc.');
			expect(res.data.year).to.be(2019);
			expect(res.data.title).to.be('Pinball play, you must');
			expect(res.data.id).to.be('pbpym2');
			expect(res.data.description).to.be('A table you can play');
			expect(res.data.instructions).to.be('Play pinball!');
		});
	});

	describe('when updating an existing game', () => {

		let game;
		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
			game = await api.gameHelper.createGame('moderator');
		});

		after(async () => await api.teardown());

		it('should fail for an non-existing game', async () => {
			await api.as('moderator')
				.patch('/v1/games/brötzl', {})
				.then(res => res.expectStatus(404));
		});

		it('should fail if an invalid field is provided', async () => {
			await api.as('moderator')
				.patch('/v1/games/' + game.id, { created_at: new Date().toString() })
				.then(res => res.expectError(400, 'invalid field'));
		});

		it('should fail if an invalid value is provided', async () => {
			await api.as('moderator')
				.patch('/v1/games/' + game.id, { game_type: 'zorg' })
				.then(res => res.expectValidationError('game_type', 'invalid game type'));
		});

		it('should succeed with minimal data', async () => {
			const title = 'Hi, I am your new title.';
			res = await api.as('moderator')
				.save('games/update')
				.patch('/v1/games/' + game.id, { title: title })
				.then(res => res.expectStatus(200));

			expect(res.data.title).to.be(title);

			// refetch to be sure.
			res = await api.get('/v1/games/' + game.id).then(res => res.expectStatus(200));
			expect(res.data.title).to.be(title);
		});
	});

	describe('when listing games', () => {

		const user = 'moderator';
		const count = 10;
		let games = [];

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
			games = await api.gameHelper.createGames(user, count);
		});

		after(async () => await api.teardown());

		it('should list all games if number of games is smaller or equal to page size', async () => {
			res = await api
				.save('games/list')
				.get('/v1/games')
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data).to.have.length(count);
		});

		it('should refuse queries with less than two characters', async () => {
			await api
				.saveResponse('games/search')
				.get('/v1/games?q=a')
				.then(res => res.expectError(400, 'must contain at least two characters'));
		});

		it('should fail when providing nonsense number for year filter', async () => {
			await api.get('/v1/games?decade=qwez').then(res => res.expectError(400, '"decade" must be an integer'));
		});

		it('should find game by game id', async () => {
			// find added game with shortest id
			const game = sortBy(games, game => game.id.length)[0];

			res = await api.get('/v1/games?q=' + game.id)
				.then(res => res.expectStatus(200));

			expect(res.data).to.be.an('array');
			expect(res.data.length).to.be.above(0);
			expect(res.data.find(g => g.id === game.id)).to.be.ok();
		});

		it('should find games by title', async () => {
			// find added game with longest title
			const game = sortBy(games, game => -game.title.length)[0];

			res = await api
				.get('/v1/games?q=' + game.title.match(/[0-9a-z]{3}/i)[0])
				.then(res => res.expectStatus(200));

			expect(res.data).to.be.an('array');
			expect(res.data.length).to.be.above(0);
			expect(res.data.find(g => g.id === game.id)).to.be.ok();
		});

		it('should find games by title split by a white space', async () => {
			// find added game with longest title
			const game = sortBy(games, game => -game.title.length)[0];

			res = await api
				.get('/v1/games?q=' + game.title.match(/[0-9a-z]{2}/i)[0] + '+' + game.title.match(/.*([0-9a-z]{2})/i)[1])
				.then(res => res.expectStatus(200));

			expect(res.data).to.be.an('array');
			expect(res.data.length).to.be.above(0);
			expect(res.data.find(g => g.id === game.id)).to.be.ok();
		});
	});

	describe('when viewing a game', () => {

		const user = 'moderator';
		let game;

		before(async () => {
			await api.setupUsers({
				moderator: { roles: [ user ]}
			});
			game = await api.gameHelper.createGame('moderator');
		});

		after(async () => await api.teardown());

		it('should return full game details', async () => {
			res = await api
				.get('/v1/games/' + game.id)
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.title).to.be(game.title);
			expect(res.data.manufacturer).to.be(game.manufacturer);
			expect(res.data.year).to.be(game.year);
			expect(res.data.game_type).to.be(game.game_type);
			expect(res.data.backglass).to.be.an('object');
			expect(res.data.backglass.variations).to.be.an('object');
			expect(res.data.backglass.variations.medium).to.be.an('object');
		});

		it('that does not exist should return a 404', async () => {
			await api.get('/v1/games/01234567890123456789').then(res => res.expectError(404));
		});
	});

	describe('when deleting a game', () => {

		const user = 'moderator';
		before(async () => {
			await api.setupUsers({
				moderator: { roles: [ user ]}
			});
		});

		after(async () => await api.teardown());

		it('should succeed if game is not referenced', async () => {
			const backglass = await api.fileHelper.createBackglass(user);
			res = await api.as(user)
				.post('/v1/games', api.gameHelper.getGame({ _backglass: backglass.id }))
				.then(res => res.expectStatus(201));
			await api.as(user)
				.save('games/delete')
				.del('/v1/games/' + res.data.id)
				.then(res => res.expectStatus(204));
		});

		it('should fail if there is a backglass attached to that game', async () => {
			const game = await api.gameHelper.createGame(user);
			const b2s = await api.fileHelper.createDirectB2S(user);
			await api.as(user)
				.markTeardown()
				.post('/v1/backglasses', {
					_game: game.id,
					authors: [ {
						_user: api.getUser(user).id,
						roles: [ 'creator' ]
					} ],
					versions: [ {
						version: '1.0',
						_file: b2s.id
					} ]
				})
				.then(res => res.expectStatus(201));
			await api.as(user)
				.save('games/delete')
				.del('/v1/games/' + game.id)
				.then(res => res.expectError(400, 'is referenced by'));
		});
	});

	describe('when requesting a release name', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			});
		});

		after(async () => await api.teardown());

		it('should return at least two words', async () => {
			const game = await api.gameHelper.createGame('moderator');
			res = await api.as('member')
				.save('games/release-name')
				.get('/v1/games/' + game.id + '/release-name')
				.then(res => res.expectStatus(200));

			expect(res.data.name.split(' ')).to.have.length(3);
		});

	});
});