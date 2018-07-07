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
/*global describe, before, after, beforeEach, afterEach, it*/
const expect = require('expect.js');

const ApiClient = require('../../test/modules/api.client');
const api = new ApiClient();

let res;
describe('The VPDB API', () => {

	before(async () => {
		await api.setupUsers({
			admin: { roles: ['admin'] },
		});
	});

	after(async () => await api.teardown());

	it('should list the API version', async () => {
		res = await api
			.get('/v1')
			.then(res => res.expectStatus(200));
		expect(res.data.app_name).to.be.ok();
		expect(res.data.app_version).to.be.ok();
	});

	it('should list all plans', async () => {
		res = await api
			.get('/v1/plans')
			.then(res => res.expectStatus(200));
		expect(res.data.length).to.be(4);
	});

	it('should list all roles', async () => {
		res = await api
			.as('admin')
			.get('/v1/roles')
			.then(res => res.expectStatus(200));
		const roles = res.data;
		expect(roles.length).to.be(8);
	});

	describe('when retrieving the sitemap', () => {

		it('should fail when providing no URL', async () => {
			res = await api
				.get('/v1/sitemap')
				.then(res => res.expectError(400, 'Must specify website URL'));
		});

		it('should fail when providing an url without protocol', async () => {
			res = await api
				.withQuery({ url: 'vpdb.io' })
				.get('/v1/sitemap')
				.then(res => res.expectError(400, 'must contain at least protocol and host name'));
		});

		it('should fail when providing an url with a query path', async () => {
			res = await api
				.withQuery({ url: 'https://vpdb.io/?suckme' })
				.get('/v1/sitemap')
				.then(res => res.expectError(400, 'must not contain a search query or hash'));
		});

		it('should return the sitemap', async () => {
			res = await api
				.withQuery({ url: 'https://vpdb.io' })
				.get('/v1/sitemap')
				.then(res => res.expectStatus(200).expectHeader('content-type', 'application/xml'));
		});
	})
});
