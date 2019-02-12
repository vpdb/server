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

const api = new ApiClient();

describe('The build cache', () => {

	let res;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator', 'contributor'] },
			admin: { roles: ['admin'] }
		});
		await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204));
	});

	afterEach(async () => await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204)));
	after(async () => await api.teardown());

	describe('when updating a property', () => {

		it('should invalidate release details', async () => {
			const id = 'v10';
			const label = 'v666';
			await api
				.as('moderator')
				.markTeardown()
				.post('/v1/builds', { label: id, type: 'release', platform: 'vp', major_version: '1' })
				.then(res => res.expectStatus(201));
			const release = await api.releaseHelper.createRelease('moderator', { builds: [ id ] });
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.versions[0].files[0].compatibility.find(c => c.id === id).label).to.be(id);

			await api.as('moderator').patch('/v1/builds/' + id, { label: label }).then(res => res.expectStatus(200));

			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.versions[0].files[0].compatibility.find(c => c.id === id).label).to.be(label);
		});

		it('should not invalidate the release list', async () => {
			const id = 'v11';
			const label = 'v777';
			await api
				.as('moderator')
				.markTeardown()
				.post('/v1/builds', { label: id, type: 'release', platform: 'vp', major_version: '1' })
				.then(res => res.expectStatus(201));
			await api.releaseHelper.createRelease('moderator', { builds: [ id ] });
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));

			await api.as('moderator').patch('/v1/builds/' + id, { label: label }).then(res => res.expectStatus(200));

			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
		});
	});

});