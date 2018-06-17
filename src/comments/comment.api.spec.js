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
const GameHelper = require('../../test/modules/game.helper');
const api = new ApiClient();
const releaseHelper = new ReleaseHelper(api);
const gameHelper = new GameHelper(api);

describe.only('The VPDB `Comment` API', () => {

	let res;
	let release, restrictedRelease;

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			member2: { roles: ['member'] },
			author: { roles: ['member'] },
			moderator: { roles: ['moderator'] },
			contributor: { roles: ['contributor'] }
		});
		const restrictedGame = await gameHelper.createGame('moderator', { ipdb: { mpu: 9999, number: 8888 } });
		release = await releaseHelper.createRelease('contributor', { author: 'author' });
		restrictedRelease = await releaseHelper.createReleaseForGame('contributor', restrictedGame, { author: 'author' });
	});

	after(async () => await api.teardown());

	describe('when creating a new comment to a release', () => {

		it('should fail when posting for an non-existing release', async () => {
			await api
				.as('member')
				.post('/v1/releases/bezerrrrk/comments', { message: '123' })
				.then(res => res.expectError(404));
		});

		it('should fail for a restricted release', async () => {
			// as any
			await api
				.as('member')
				.post('/v1/releases/' + restrictedRelease.id + '/comments', { message: '123' })
				.then(res => res.expectError(404, 'no such release'));

			// as author
			await api
				.as('author')
				.post('/v1/releases/' + restrictedRelease.id + '/comments', { message: '123' })
				.then(res => res.expectError(404, 'no such release'));

			// as uploader
			await api
				.as('contributor')
				.post('/v1/releases/' + restrictedRelease.id + '/comments', { message: '123' })
				.then(res => res.expectError(404, 'no such release'));

			// as moderator
			await api
				.as('moderator')
				.post('/v1/releases/' + restrictedRelease.id + '/comments', { message: '123' })
				.then(res => res.expectError(404, 'no such release'));
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

	});

	describe('when creating a new moderation comment to a release', () => {

		it('should fail when the release does not exist', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('contributor')
				.post('/v1/releases/no-existo/moderate/comments', { message: msg })
				.then(res => res.expectError(404));
		});

		it('should fail if the user is none of author, uploader or moderator', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('member')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectError(403, 'must be either moderator or owner or author'));
		});

		it('should succeed as author', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('author')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectStatus(201));
			const comment = res.data;

			// check that it's listed also
			res = await api.as('author').get('/v1/releases/' + release.id + '/moderate/comments').then(res => res.expectStatus(200));
			expect(res.data.find(c => c.id === comment.id)).to.be.ok();
		});

		it('should succeed as uploader', async () => {
			const msg = faker.company.catchPhrase();
			await api
				.as('contributor')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectStatus(201));
		});

		it('should succeed as moderator', async () => {
			const msg = faker.company.catchPhrase();
			await api
				.as('moderator')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectStatus(201));
		});

	});

	describe('when listing comments under a release', () => {

		it('should fail when the release does not exist', async () => {
			res = await api
				.as('contributor')
				.get('/v1/releases/no-existo/comments')
				.then(res => res.expectError(404));
		});

		it('should fail for a restricted release as none of author, uploader or moderator', async () => {

			// as any
			await api
				.as('member')
				.get('/v1/releases/' + restrictedRelease.id + '/comments')
				.then(res => res.expectError(404, 'no such release'));
		});

		it('should succeed for a restricted release as author, uploader and moderator', async () => {

			// as author
			await api
				.as('author')
				.get('/v1/releases/' + restrictedRelease.id + '/comments')
				.then(res => res.expectStatus(200));

			// as uploader
			await api
				.as('contributor')
				.get('/v1/releases/' + restrictedRelease.id + '/comments')
				.then(res => res.expectStatus(200));

			// as moderator
			await api
				.as('moderator')
				.get('/v1/releases/' + restrictedRelease.id + '/comments')
				.then(res => res.expectStatus(200));
		});

		it('should list a comment', async () => {
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

		it('should return the correct counters', async () => {
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

	describe('when listing moderation comments of a release', () => {

		it('should fail when the release does not exist', async () => {
			res = await api
				.as('moderator')
				.get('/v1/releases/no-existo/moderate/comments')
				.then(res => res.expectError(404));
		});

		it('should fail if the user is none of author, uploader or moderator', async () => {
			res = await api
				.as('member')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectError(403, 'must be either moderator or owner or author'));
		});

		it('should succeed as author', async () => {
			res = await api
				.as('author')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
		});

		it('should succeed as uploader', async () => {
			await api
				.as('contributor')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
		});

		it('should succeed as moderator', async () => {
			await api
				.as('moderator')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
		});

	});

});