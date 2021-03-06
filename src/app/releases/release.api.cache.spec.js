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
const expect = require('expect.js');

const ApiClient = require('../../test/api.client');
const ReleaseHelper = require('../../test/release.helper');

const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

describe('The release cache', () => {

	let res;
	let release, otherRelease;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			admin: { roles: ['admin'] }
		});
		release = await releaseHelper.createRelease('moderator');
		otherRelease = await releaseHelper.createRelease('moderator');
		await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204));
	});

	afterEach(async () => await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204)));
	after(async () => await api.teardown());

	describe('when viewing releases', () => {

		it('should cache release list for same user', async () => {
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should not cache release list for different user', async () => {
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('member').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('moderator').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
		});

		it('should cache release details but update view counter', async () => {
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const views = res.data.counter.views;
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.views).to.be(views + 1);
		});

		it('should not cache release list with a search query', async () => {
			res = await api.withQuery({ q: release.name }).get('/v1/releases').then(res => res.expectNoHeader('x-cache-api'));
			res = await api.withQuery({ q: release.name }).get('/v1/releases').then(res => res.expectNoHeader('x-cache-api'));
		});

	});

	describe('when updating a release', () => {

		it('should invalidate the cache of the release', async () => {
			const r = await releaseHelper.createRelease('moderator');
			res = await api.get(`/v1/releases/${r.id}`).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('moderator').patch(`/v1/releases/${r.id}`, { name: 'updated-name' }).then(res => res.expectStatus(200));
			res = await api.get(`/v1/releases/${r.id}`).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.name).to.be('updated-name');
		});

		it('should update the counters of the version', async () => {
			const r = await api.releaseHelper.createRelease('moderator', { version: '1.0'});
			await api.as('member').get(r.versions[0].files[0].file.url).then(res => res.expectStatus(200));
			res = await api.get(`/v1/releases/${r.id}`).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.versions[0].counter.downloads).to.be(1);

			await api
				.as('moderator')
				.patch(`/v1/releases/${r.id}/versions/1.0`, { version: 'v1.1' })
				.then(res => res.expectStatus(200));
			res = await api.get(`/v1/releases/${r.id}`).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.versions[0].version).to.be('v1.1');
			expect(res.data.versions[0].counter.downloads).to.be(1);
		});
	});

	describe('when starring a release', () => {

		const user = 'member';

		// remove star
		afterEach(async () => await api.as(user).del('/v1/releases/' + release.id + '/star').then(res => res.expectStatus(204)));

		it('should invalidate release list for starring user', async () => {

			// first, it's a miss
			res = await api.as(user).get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as(user).get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(r => r.id === release.id).starred).to.be(false);

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// miss again, because of `starred` flag in release list
			res = await api.as(user).get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.find(r => r.id === release.id).starred).to.be(true);
		});

		it('should cache release list for other users but update star counter', async () => {

			// first, it's a miss
			res = await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			const numStars = res.data.find(r => r.id === release.id).counter.stars;

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			res = await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(r => r.id === release.id).counter.stars).to.be(numStars + 1);
		});

		it('should cache release details for starring user but update star counter', async () => {
			const url = '/v1/releases/' + release.id;

			// first, it's a miss
			res = await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			const numStars = res.data.counter.stars;

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			res = await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.stars).to.be(numStars + 1);
		});

		it('should invalidate game details for starring user', async () => {
			const url = '/v1/games/' + release.game.id;

			// first, it's a miss
			res = await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.releases.find(r => r.id === release.id).starred).to.be(false);

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// miss again, because of `starred` flag in release list
			res = await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.releases.find(r => r.id === release.id).starred).to.be(true);
		});

		it('should cache game details for other users but update star counter', async () => {
			const url = '/v1/games/' + release.game.id;

			// first, it's a miss
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			const numStars = res.data.releases.find(r => r.id === release.id).counter.stars;

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.releases.find(r => r.id === release.id).counter.stars).to.be(numStars + 1);
		});

		it('should cache game list', async () => {
			const url = '/v1/games';

			// first, it's a miss
			await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get(url).then(res => res.expectHeader('x-cache-api', 'miss'));

			// star
			await api.as(user).post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hit
			await api.as(user).get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
			await api.get(url).then(res => res.expectHeader('x-cache-api', 'hit'));
		});

	});

	describe('when rating a release', () => {

		const user = 'member';

		// remove rating
		afterEach(async () => await api.as(user).del('/v1/releases/' + release.id + '/rating').then(res => res.expectStatus(204)));

		it('should invalidate release list and details of rated release', async () => {

			// cache future misses
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));

			// cache future hits
			await api.get('/v1/releases/' + otherRelease.id).then(res => res.expectHeader('x-cache-api', 'miss'));

			// rate
			await api.as(user).post('/v1/releases/' + release.id + '/rating', { value: 5 }).then(res => res.expectStatus(201));

			// assert
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			//await api.get('/v1/releases/' + otherRelease.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			// TODO uncomment: currently fails because the vote changes the global mean which triggers a complete invalidation.
		});

		it('should invalidate game details of rated release', async () => {
			const url = '/v1/games/' + release.game.id;

			// cache future misses
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.releases.find(r => r.id === release.id).rating.average).to.be(0);

			// rate
			await api.as(user).post('/v1/releases/' + release.id + '/rating', { value: 5 }).then(res => res.expectStatus(201));

			// assert
			res = await api.get(url).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.releases.find(r => r.id === release.id).rating.average).to.be(5);
		});
	});

	describe('when downloading a release', () => {

		it('should cache release details but update download counters', async () => {

			// create release and cache details
			const release = await api.releaseHelper.createRelease('moderator');

			// get uncached counters
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const releaseCounter = res.data.counter.downloads;
			const versionCounter = res.data.versions[0].counter.downloads;
			const versionFileCounter = res.data.versions[0].files[0].counter.downloads;
			const fileCounter = res.data.versions[0].files[0].file.counter.downloads;

			// download release
			await api.onStorage()
				.as('moderator')
				.withHeader('Accept', 'application/zip')
				.post('/v1/releases/' + release.id, { files: [release.versions[0].files[0].file.id] })
				.then(res => res.expectStatus(200));

			// it's a hit but counter is updated
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.downloads).to.be(releaseCounter + 1);
			expect(res.data.versions[0].counter.downloads).to.be(versionCounter + 1);
			expect(res.data.versions[0].files[0].counter.downloads).to.be(versionFileCounter + 1);
			expect(res.data.versions[0].files[0].file.counter.downloads).to.be(fileCounter + 1);
		});
	});
});