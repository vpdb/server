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

const ApiClient = require('../../test/api.client');

const api = new ApiClient();

describe('The misc cache', () => {

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			admin: { roles: ['admin'] }
		});
		await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204));
	});

	afterEach(async () => await api.as('admin').del('/v1/cache').then(res => res.expectStatus(204)));
	after(async () => await api.teardown());

	describe('when viewing the sitemap', () => {

		it('should cache the sitemap', async () => {
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'hit'));
		});

	});

	describe('when adding a game', () => {

		it('should invalidate the sitemap', async () => {
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'hit'));

			await api.gameHelper.createGame('moderator');
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'miss'));
		});

	});


	describe('when adding a release', () => {

		it('should invalidate the sitemap', async () => {
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'miss'));
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'hit'));

			await api.releaseHelper.createRelease('moderator');
			await api.get('/v1/sitemap?url=https://vpdb').then(res => res.expectHeader('x-cache-api', 'miss'));
		});

	});

});