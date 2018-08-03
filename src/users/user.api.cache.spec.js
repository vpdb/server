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

const { pick } = require('lodash');
const expect = require('expect.js');

const ApiClient = require('../../test/modules/api.client');

const api = new ApiClient();

describe('The user cache', () => {

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

	describe('when updating a visible property of the user profile', () => {

		it('should invalidate release details', async () => {
			const username = 'updated username';
			const user = await api.createUser();
			const release = await api.releaseHelper.createRelease('moderator', { author: user });
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.authors[0].user.name).to.be(user.name);

			user.name = username;
			await api.as('admin').put('/v1/users/' + user.id, pick(user, ['email', 'username', 'name', 'is_active', 'roles', '_plan' ]))
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			expect(res.data.authors[0].user.id).to.be(user.id);
			expect(res.data.authors[0].user.name).to.be(username);
		});

		it('should invalidate the release list', async () => {
			const username = 'updated username 2';
			const user = await api.createUser();
			const release = await api.releaseHelper.createRelease('moderator', { author: user });
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			res = await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
			expect(res.data.find(rls => rls.id === release.id).authors[0].user.name).to.be(user.name);

			user.name = username;
			await api.as('admin').put('/v1/users/' + user.id, pick(user, ['email', 'username', 'name', 'is_active', 'roles', '_plan' ]))
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			const rls = res.data.find(r => r.id === release.id);
			expect(rls.authors[0].user.id).to.be(user.id);
			expect(rls.authors[0].user.name).to.be(username);
		});
	});

	describe('when updating a invisible property of the user profile', () => {

		it('should not invalidate release details', async () => {
			const locationAfter = 'updated location';
			const user = await api.createUser();

			const release = await api.releaseHelper.createRelease('moderator', { author: user });
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));

			user.location = locationAfter;
			await api.as('admin').put('/v1/users/' + user.id, pick(user, ['email', 'username', 'name', 'is_active', 'roles', '_plan', 'location' ]))
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases/' + release.id).then(res => res.expectHeader('x-cache-api', 'hit'));
		});

		it('should not invalidate the release list', async () => {
			const locationAfter = 'updated location';
			const user = await api.createUser();

			await api.releaseHelper.createRelease('moderator', { author: user });
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));

			user.location = locationAfter;
			await api.as('admin').put('/v1/users/' + user.id, pick(user, ['email', 'username', 'name', 'is_active', 'roles', '_plan', 'location' ]))
				.then(res => res.expectStatus(200));

			res = await api.get('/v1/releases').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

	});
});