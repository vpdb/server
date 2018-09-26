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

describe('The game cache', () => {

	let res, existingGame, providerToken;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator', 'contributor'] },
			admin: { roles: ['admin'] }
		});
		existingGame = await api.gameHelper.createGame('moderator');
		await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204));

		// create provider token
		let res = await api.as('admin').markTeardown().post('/v1/tokens', {
			label: 'Auth test token',
			password: api.getUser('admin').password,
			provider: 'ipbtest', type: 'provider',
			scopes: [ 'community', 'service' ]
		}).then(res => res.expectStatus(201));
		providerToken = res.data.token;
	});


	afterEach(async () => await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204)));
	after(async () => await api.teardown());

	describe('when viewing games', () => {

		it('should cache details but update view counter', async () => {
			res = await api.get('/v1/games/' + existingGame.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const views = res.data.counter.views;
			res = await api.get('/v1/games/' + existingGame.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.views).to.be(views + 1);
		});

		it('should cache game list for same user', async () => {
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));

			await api.as('member').get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('member').get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should cache game list for same provider', async () => {
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.withToken(providerToken).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.withToken(providerToken).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

	});

	describe('when adding a new game', () => {

		it('should invalidate the game list', async () => {
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			const game = await api.gameHelper.createGame('moderator');
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.find(g => g.id === game.id)).to.be.ok();
		});

		it('should not invalidate existing game details', async () => {
			await api.get('/v1/games/' + existingGame.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/games/' + existingGame.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.gameHelper.createGame('moderator');
			await api.get('/v1/games/' + existingGame.id).then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should invalidate the provider cache when a user provider user is authenticated', async () => {
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.withToken(providerToken).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.createOAuthUser('ipbtest');

			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.withToken(providerToken).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.withToken(providerToken).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
		});
	});

	describe('when updating an existing game', () => {

		it('should invalidate the game list', async () => {
			const gameTitle = 'updated game title';
			const game = await api.gameHelper.createGame('moderator');
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.as('moderator').patch('/v1/games/' + game.id, { title: gameTitle })
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.find(g => g.id === game.id)).to.be.ok();
			expect(res.data.find(g => g.id === game.id).title).to.be(gameTitle);
		});

		it('should invalidate release details when updating the title', async () => {
			const gameTitle = 'updated game title';
			const game = await api.gameHelper.createGame('moderator');
			const release = await api.releaseHelper.createReleaseForGame('moderator', game);
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.as('moderator').patch('/v1/games/' + game.id, { title: gameTitle })
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.game.title).to.be(gameTitle);
		});

		it('should not invalidate release details when updating the description', async () => {
			const gameDescription = 'updated game description';
			const game = await api.gameHelper.createGame('moderator');
			const release = await api.releaseHelper.createReleaseForGame('moderator', game);
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.as('moderator').patch('/v1/games/' + game.id, { description: gameDescription })
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
		});
	});

	describe('when starring a game', () => {

		const user = 'member';

		// remove star
		afterEach(async () => await api.as(user).del('/v1/games/' + existingGame.id + '/star').then(res => res.expectStatus(204)));

		it('should cache game list but update star counter', async () => {

			// first, it's a miss
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as(user).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			const numStars = res.data.find(g => g.id === existingGame.id).counter.stars;

			// star
			await api.as(user).post('/v1/games/' + existingGame.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(g => g.id === existingGame.id).counter.stars).to.be(numStars + 1);
			res = await api.as(user).get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(g => g.id === existingGame.id).counter.stars).to.be(numStars + 1);
		});

		it('should cache game details but update star counter', async () => {
			const url = '/v1/games/' + existingGame.id;

			// first, it's a miss
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			const numStars = res.data.counter.stars;

			// star
			await api.as(user).post(url + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.stars).to.be(numStars + 1);
		});
	});

	describe('when adding a release to a game', () => {

		it('should cache game list but update release counter', async () => {

			// create game and cache list
			const game = await api.gameHelper.createGame('moderator');
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			const numReleases = res.data.find(g => g.id === game.id).counter.releases;

			// add release
			await api.releaseHelper.createReleaseForGame('moderator', game);

			// it's a hit but counter is updated
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(g => g.id === game.id).counter.releases).to.be(numReleases + 1);
		});

		it('should invalidate game details', async () => {

			// create game and cache details
			const game = await api.gameHelper.createGame('moderator');
			res = await api.get('/v1/games/' + game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const numReleases = res.data.counter.releases;

			// add release
			let release = await api.releaseHelper.createReleaseForGame('moderator', game);

			// miss, because now the game contains the full release as well
			res = await api.get('/v1/games/' + game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.counter.releases).to.be(numReleases + 1);
			expect(res.data.releases.find(r => r.id === release.id)).to.be.ok();
		});
	});

	describe('when adding a backglass to a game', () => {

		it('should cache game list', async () => {

			// create game and cache list
			const game = await api.gameHelper.createGame('moderator');
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));

			// add backglass
			await api.releaseHelper.createDirectB2S('moderator', { game: game });

			// it's a hit
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should invalidate game details', async () => {

			// create game and cache details
			const game = await api.gameHelper.createGame('moderator');
			res = await api.get('/v1/games/' + game.id).then(res => res.expectHeader('x-cache-api', 'miss'));

			// add backglass
			let backglass = await api.releaseHelper.createDirectB2S('moderator', { game: game });

			// miss, because now the game contains the full release as well
			res = await api.get('/v1/games/' + game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.backglasses.find(r => r.id === backglass.id)).to.be.ok();
		});
	});

	describe('when downloading a release of a game', () => {

		it('should cache game list but update download counter', async () => {

			// create release and cache list
			const release = await api.releaseHelper.createRelease('moderator');
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			const numDownloads = res.data.find(g => g.id === release.game.id).counter.downloads;

			// download release
			await api.onStorage()
				.as('moderator')
				.withHeader('Accept', 'application/zip')
				.post('/v1/releases/' + release.id, { files: [release.versions[0].files[0].file.id] })
				.then(res => res.expectStatus(200));

			// it's a hit but counter is updated
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(g => g.id === release.game.id).counter.downloads).to.be(numDownloads + 1);
		});

		it('should cache game details but update download counters', async () => {

			// create release and cache details
			const release = await api.releaseHelper.createRelease('moderator');
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			let game = res.data;
			const gameCounter = game.counter.downloads;
			const releaseCounter = game.releases[0].counter.downloads;
			const versionCounter = game.releases[0].versions[0].counter.downloads;
			const versionFileCounter = game.releases[0].versions[0].files[0].counter.downloads;
			const fileCounter = game.releases[0].versions[0].files[0].file.counter.downloads;

			// download release
			await api.onStorage()
				.as('moderator')
				.withHeader('Accept', 'application/zip')
				.post('/v1/releases/' + release.id, { files: [release.versions[0].files[0].file.id] })
				.then(res => res.expectStatus(200));

			// it's a hit but counter is updated
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			game = res.data;
			expect(game.counter.downloads).to.be(gameCounter + 1);
			expect(game.releases[0].counter.downloads).to.be(releaseCounter + 1);
			expect(game.releases[0].versions[0].counter.downloads).to.be(versionCounter + 1);
			expect(game.releases[0].versions[0].files[0].counter.downloads).to.be(versionFileCounter + 1);
			expect(game.releases[0].versions[0].files[0].file.counter.downloads).to.be(fileCounter + 1);
		});
	});

	describe('when commenting a release of a game', () => {

		it('should cache game list but update comments counter', async () => {

			// create release and cache list
			const release = await api.releaseHelper.createRelease('moderator');
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'miss'));
			const numComments = res.data.find(g => g.id === release.game.id).counter.comments;

			// comment release
			await api
				.as('member')
				.post('/v1/releases/' + release.id + '/comments', { message: 'a comment' })
				.then(res => res.expectStatus(201));

			// it's a hit but counter is updated
			res = await api.get('/v1/games').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(g => g.id === release.game.id).counter.comments).to.be(numComments + 1);
		});

		it('should cache game details but update comments counter', async () => {

			// create release and cache details
			const release = await api.releaseHelper.createRelease('moderator');
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const numComments = res.data.counter.comments;

			// comment release
			await api
				.as('member')
				.post('/v1/releases/' + release.id + '/comments', { message: 'a comment' })
				.then(res => res.expectStatus(201));

			// it's a hit but counter is updated
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.comments).to.be(numComments + 1);
		});
	});

});