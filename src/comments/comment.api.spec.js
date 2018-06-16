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
/* global describe, before, after, it */

const expect = require('expect.js');
const faker = require('faker');

const ApiClient = require('../../test/modules/api.client');
const ReleaseHelper = require('../../test/modules/release.helper');
const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);

describe('The VPDB `Comment` API', () => {

	let res;

	describe('when creating a new comment', () => {

		let release;

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				member2: { roles: ['member'] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: ['contributor'] }
			});
			release = await releaseHelper.createRelease('contributor');
		});

		after(async () => await api.teardown());

		it('should fail when posting for an non-existing release', async () => {
			await api
				.as('member')
				.post('/v1/releases/bezerrrrk/comments', { message: '123' })
				.then(res => res.expectStatus(404));
		});

		it('should fail when posting an empty message', async () => {
			await api
				.as('member')
				.post('/v1/releases/' + release.id + '/comments', {})
				.then(res => res.expectValidationError('message', 'must provide a message'));
		});

		it('should succeed when posting correct data', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('member')
				.save('releases/create-comment')
				.post('/v1/releases/' + release.id + '/comments', { message: msg })
				.then(res => res.expectStatus(201));
			expect(res.data.from.id).to.be(api.getUser('member').id);
			expect(res.data.message).to.be(msg);
		});

		it('should list a comment under the release after creation', async () => {
			const msg = faker.company.catchPhrase();
			await api
				.as('member')
				.post('/v1/releases/' + release.id + '/comments', { message: msg })
				.then(res => res.expectStatus(201));

			res = await api
				.get('/v1/releases/' + release.id + '/comments')
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data[res.data.length - 1].message).to.be(msg);
		});

		it('should return the correct counters after creation', async () => {
			const msg = faker.company.catchPhrase();

			await api
				.as('member2')
				.post('/v1/releases/' + release.id + '/comments', { message: msg })
				.then(res => res.expectStatus(201));

			// check release counter
			res = await api.get('/v1/releases/' + release.id).then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.counter.comments).to.be.greaterThan(0);

			// check user counter
			res = await api.as('member2').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.counter.comments).to.be(1);

			// check game counter
			res = await api.get('/v1/games/' + release.game.id).then(res => res.expectStatus(200));
			expect(res.data.counter.comments).to.be.greaterThan(0);

		});
	});

});