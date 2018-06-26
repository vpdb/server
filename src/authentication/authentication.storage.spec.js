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

describe('The authentication engine of the VPDB storage API', () => {

	let res;
	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] }
		});
	});

	after(async () => await api.teardown());

	describe('when retrieving a storage token', () => {

		it('should fail when not authenticated', async () => {
			await api
				.onStorage()
				.post('/v1/authenticate')
				.then(res => res.expectStatus(401));
		});

		it('should fail when providing no path', async () => {
			await api
				.onStorage()
				.as('member')
				.post('/v1/authenticate')
				.then(res => res.expectValidationError('paths', 'must provide the paths'));
		});

		it('should succeed when providing one path', async () => {
			res = await api
				.onStorage()
				.as('member')
				.post('/v1/authenticate', { paths: '/' })
				.then(res => res.expectStatus(200));
			expect(res.data['/']).to.be.a('string');
		});

		it('should succeed when providing multiple path', async () => {
			res = await api
				.onStorage()
				.save('auth/storage')
				.as('member')
				.post('/v1/authenticate', { paths: ['/foo', '/bar'] })
				.then(res => res.expectStatus(200));
			expect(res.data['/foo']).to.be.a('string');
			expect(res.data['/bar']).to.be.a('string');
		});

		it('should succeed when providing a complete url', async () => {
			res = await api
				.onStorage()
				.as('member')
				.post('/v1/authenticate', { paths: ['/bar', 'http://foo/bar'] })
				.then(res => res.expectStatus(200));
			expect(res.data['/bar']).to.be.a('string');
			expect(res.data['http://foo/bar']).to.be(res.data['/bar']);
		});

	});

});