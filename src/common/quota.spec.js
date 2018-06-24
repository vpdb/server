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
/* global describe, before, after, beforeEach, afterEach, it */

const expect = require('expect.js');

const ApiClient = require('../../test/modules/api.client');
const ReleaseHelper = require('../../test/modules/release.helper');

const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

describe('The quota engine of VPDB', () => {

	let res, release, chargedUrl, unchargedUrl;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			ratetest1: { roles: ['member'] },
			ratetest2: { roles: ['member'] },
			ratetest3: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			unlimited: { roles: ['member'], _plan: 'unlimited' }
		});
		release = await releaseHelper.createRelease('moderator');
		chargedUrl = release.versions[0].files[0].file.url;
		unchargedUrl = release.versions[0].files[0].playfield_image.url;
	});

	after(async () => await api.teardown());

	describe('when displaying the user profile', () => {

		it('should show the correct rate', async () => {
			res = await api.as('member').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.quota.unlimited).to.be(false);
			expect(res.data.quota.period).to.be(86400);
			expect(res.data.quota.limit).to.be(3);
			expect(res.data.quota.remaining).to.be(3);
			expect(res.data.quota.reset).to.be(86400);

			res = await api.as('unlimited').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.quota.unlimited).to.be(true);
			expect(res.data.quota.period).to.be(0);
			expect(res.data.quota.limit).to.be(0);
			expect(res.data.quota.remaining).to.be(0);
			expect(res.data.quota.reset).to.be(0);
		});

	});

	describe('when downloading a non chargeable item', () => {

		it('should not decrement the counter', async () => {
			res = await api
				.as('ratetest3')
				.getAbsolute(ApiClient.urlPath(unchargedUrl))
				.then(res => res.expectStatus(200));

			expect(res.headers['x-ratelimit-limit']).to.not.be.ok();
			expect(res.headers['x-ratelimit-remaining']).to.not.be.ok();

			res = await api.as('ratetest3').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.quota.limit).to.be(3);
			expect(res.data.quota.remaining).to.be(3);
		});

	});

	describe('when downloading a chargeable item', () => {

		it('should refuse download when not logged', async () => {
			res = await api
				.getAbsolute(ApiClient.urlPath(chargedUrl))
				.then(res => res.expectError(401, 'need to provide credentials'));
		});

		it('should refuse download if there is no more remaining rate', async () => {
			for (let n = 0; n < 4; n++) {
				res = await api
					.as('ratetest2')
					.getAbsolute(ApiClient.urlPath(chargedUrl))
					.then(res => {
						if (n < 3) {
							res.expectStatus(200);
							expect(res.headers['x-ratelimit-limit']).to.be.ok();
							expect(res.headers['x-ratelimit-remaining']).to.be.ok();
							expect(res.headers['x-ratelimit-reset']).to.be.ok();

							const limit = parseInt(res.headers['x-ratelimit-limit']);
							const remaining = parseInt(res.headers['x-ratelimit-remaining']);

							expect(limit - remaining).to.equal(n + 1);
						} else {
							res.expectError(403, 'No more quota left');
						}
					});
			}
		});

		it('should show but not decrement the counter when using HEAD', async () => {
			res = await api.as('member').get('/v1/profile').then(res => res.expectStatus(200));
			const limit = res.data.quota.limit;
			const remaining = res.data.quota.remaining;
			res = await api
				.as('ratetest1')
				.headAbsolute(ApiClient.urlPath(chargedUrl))
				.then(res => res.expectStatus(200));
			expect(res.headers['x-ratelimit-limit']).to.be(String(limit));
			expect(res.headers['x-ratelimit-remaining']).to.be(String(remaining));
		});

		it('should return the correct rate in the HTTP header and profile', async () => {

			const token = await api.retrieveStorageToken('ratetest1', chargedUrl);
			res = await api
				.withQuery({ token: token })
				.getAbsolute(ApiClient.urlPath(chargedUrl))
				.then(res => res.expectStatus(200));

			expect(res.headers['x-ratelimit-limit']).to.be.ok();
			expect(res.headers['x-ratelimit-remaining']).to.be.ok();
			expect(res.headers['x-ratelimit-reset']).to.be.ok();
			expect(res.headers['x-ratelimit-unlimited']).to.be.ok();

			const limit = parseInt(res.headers['x-ratelimit-limit']);
			const remaining = parseInt(res.headers['x-ratelimit-remaining']);

			expect(limit - remaining).to.equal(1);

			res = await api.as('ratetest1').get('/v1/profile').then(res => res.expectStatus(200));
			expect(limit).to.be(res.data.quota.limit);
			expect(remaining).to.be(res.data.quota.remaining);
		});

		it('should return the correct rate in the HTTP header for unlimited', async () => {
			res = await api
				.as('unlimited')
				.getAbsolute(ApiClient.urlPath(chargedUrl))
				.then(res => res.expectStatus(200));

			expect(res.headers['x-ratelimit-limit']).to.be('0');
			expect(res.headers['x-ratelimit-remaining']).to.be('0');
			expect(res.headers['x-ratelimit-reset']).to.be('0');
			expect(res.headers['x-ratelimit-unlimited']).to.be('true');
		});

		it('should not decrement the quota if an owned file is downloaded');

	});

});
