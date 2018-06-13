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

const ApiClient = require('../../test/modules/api.client');
const ReleaseHelper = require('../../test/modules/release.helper');

const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

describe.only('The VPDB API cache', () => {

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

	describe('when listing releases', () => {

		it('should cache the second request', async () => {
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should not cache the same request for a different user', async () => {
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('member').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('moderator').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
		});
	});

	describe('when viewing a game', () => {

		it('should cache the second request while updating counter', async () => {
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const views = res.data.counter.views;
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.views).to.be(views + 1);
		});
	});

	describe('when starring a release', () => {

		it('should not invalidate release details and releases', async () => {

			// these must be a hit later
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.as('member').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			res = await api.as('member').get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			const numStars = res.data.counter.stars;

			// star
			await api.as('member').post('/v1/releases/' + release.id + '/star', {}).then(res => res.expectStatus(201));

			// assert hits
			await api.as('member').get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
			res = await api.as('member').get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.stars).to.be(numStars + 1);
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.counter.stars).to.be(numStars + 1);
		});
	});
});