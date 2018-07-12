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

"use strict"; /* global describe, before, after, it */

const expect = require('expect.js');
const faker = require('faker');

const ApiClient = require('../../../test/modules/api.client');
const api = new ApiClient();

let res;
describe('The VPDB moderation feature', () => {

	let game, backglass, release;

	before(async () => {
		await api.setupUsers({
			member: { roles: ['member'] },
			member2: { roles: [ 'member' ] },
			moderator: { roles: ['moderator'] }
		});
		game = await api.gameHelper.createGame('moderator');
		const b2s = await api.fileHelper.createDirectB2S('member', { keep: true });
		res = await api
			.as('member')
			.markTeardown()
			.post('/v1/backglasses', {
				_game: game.id,
				authors: [{
					_user: api.getUser('member').id,
					roles: ['creator']
				}],
				versions: [{
					version: '1.0',
					_file: b2s.id
				}]
			}).then(res => res.expectStatus(201));
		backglass = res.data;
		release = await api.releaseHelper.createRelease('member');
	});

	after(async () => await api.teardown());

	describe('when moderating a backglass', () => {

		it('should fail for invalid backglass', async () => {
			await api
				.as('moderator')
				.post('/v1/backglasses/zigizagizug/moderate', {})
				.then(res => res.expectError(404, 'no such backglass'));
		});

		it('should fail for empty data', async () => {
			await api
				.as('moderator')
				.post('/v1/backglasses/' + backglass.id + '/moderate', {})
				.then(res => res.expectValidationError('action', 'must be provided').expectNumValidationErrors(1));
		});

		it('should fail for invalid action', async () => {
			await api
				.as('moderator')
				.post('/v1/backglasses/' + backglass.id + '/moderate', { action: 'brümütz!!'})
				.then(res => res.expectValidationError('action', 'invalid action').expectNumValidationErrors(1));
		});

		describe('when accepting', () => {

			it('should succeed approval', async () => {
				const unapprovedBackglass = await api.releaseHelper.createDirectB2S('member');
				res = await api
					.as('moderator')
					.post('/v1/backglasses/' + unapprovedBackglass.id + '/moderate', { action: 'approve' })
					.then(res => res.expectStatus(200));

				expect(res.data.is_approved).to.be(true);
				expect(res.data.is_refused).to.be(false);
				expect(res.data.auto_approved).to.be(false);
				expect(res.data.history).to.be.an('array');
				expect(res.data.history).to.have.length(1);
			});
		});

		describe('when refusing', () => {

			it('should fail when message is missing', async () => {
				await api
					.as('moderator')
					.post('/v1/backglasses/' + backglass.id + '/moderate', { action: 'refuse' })
					.then(res => res.expectValidationError('message', 'message must be provided').expectNumValidationErrors(1));
			});

			it('should succeed refusal', async () => {
				const refusedBackglass = await api.releaseHelper.createDirectB2S('member');
				await api
					.as('moderator')
					.post('/v1/backglasses/' + refusedBackglass.id + '/moderate', { action: 'refuse', message: 'Your request has been denied.' })
					.then(res => res.expectStatus(200));
			});
		});

		describe('when resetting', () => {

		});

		describe('when auto-accepting', () => {

		});

	});

	describe('when listing backglasses with moderation fields', () => {

		it('should fail as anonymous', async () => {
			await api
				.withQuery({ fields: 'moderation' })
				.get('/v1/backglasses')
				.then(res => res.expectError(403, 'must be logged'));
		});

		it('should fail as non-moderator', async () => {
			await api
				.as('member')
				.withQuery({ fields: 'moderation' })
				.get('/v1/backglasses')
				.then(res => res.expectError(403, 'must be moderator'));
		});

		it('should succeed as moderator', async () => {
			await api
				.as('moderator')
				.withQuery({ fields: 'moderation' })
				.get('/v1/backglasses')
				.then(res => res.expectStatus(200));
		});

	});

	describe('when listing moderated backglasses', () => {

		it('should fail as anonymous', async () => {
			await api
				.withQuery({ moderation: 'all' })
				.get('/v1/backglasses')
				.then(res => res.expectError(401, 'Must be logged in order to retrieve moderated items'));
		});

		it('should fail as member', async () => {
			await api
				.as('member')
				.withQuery({ moderation: 'all' })
				.get('/v1/backglasses')
				.then(res => res.expectError(403, 'Must be moderator'));
		});

		it('should fail with an invalid parameter', async () => {
			await api
				.as('moderator')
				.withQuery({ moderation: 'duh' })
				.get('/v1/backglasses')
				.then(res => res.expectError(400, 'Invalid moderation filter'));
		});

		it('should never list the backglass without requesting moderated entities', async () => {
			res = await api.get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();

			res = await api.as('member2').get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();

			res = await api.as('member').get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();

			res = await api.as('moderator').get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();
		});

		it('should succeed listing pending backglasses', async () => {
			res = await api
				.as('moderator')
				.withQuery({ moderation: 'pending' })
				.get('/v1/backglasses')
				.then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).to.be.ok();
		});

		it('should succeed listing all entities', async () => {
			res = await api
				.as('moderator')
				.withQuery({ moderation: 'all' })
				.get('/v1/backglasses')
				.then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).to.be.ok();
		});

		it('should not list the backglass when requesting other statuses', async () => {
			res = await api.as('moderator').withQuery({ moderation: 'refused' }).get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();
			res = await api.as('moderator').withQuery({ moderation: 'auto_approved' }).get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();
			res = await api.as('moderator').withQuery({ moderation: 'manually_approved' }).get('/v1/backglasses').then(res => res.expectStatus(200));
			expect(res.data.find(b => b.id === backglass.id)).not.to.be.ok();
		});
	});

	describe('when retrieving backglass details', () => {

		it('should fail as anonymous an non-creator', async () => {
			await api.get('/v1/backglasses/' + backglass.id).then(res => res.expectStatus(404));
			await api.as('member2').get('/v1/backglasses/' + backglass.id).then(res => res.expectStatus(404));
		});

		it('should succeed as creator and moderator', async () => {
			await api.as('member').get('/v1/backglasses/' + backglass.id).then(res => res.expectStatus(200));
			await api.as('moderator').get('/v1/backglasses/' + backglass.id).then(res => res.expectStatus(200));
		});
	});

	describe('when commenting a moderated release', () => {

		it('should fail if the commentator is neither owner nor moderator', async () => {
			await api
				.as('member2')
				.post('/v1/releases/' + release.id + '/moderate/comments', {})
				.then(res => res.expectError(403, 'must be either moderator or owner'));
		});

		it('should succeed when posting as owner', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('member')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectStatus(201));
			expect(res.data.from.id).to.be(api.getUser('member').id);
			expect(res.data.message).to.be(msg);

			res = await api
				.as('member')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data).to.not.be.empty();
		});

		it('should succeed when posting as moderator', async () => {
			const msg = faker.company.catchPhrase();
			res = await api
				.as('moderator')
				.post('/v1/releases/' + release.id + '/moderate/comments', { message: msg })
				.then(res => res.expectStatus(201));

			expect(res.data.from.id).to.be(api.getUser('moderator').id);
			expect(res.data.message).to.be(msg);
		});

	});

	describe('when listing moderation comments of a release', () => {

		it('should fail if the commentator is neither owner nor moderator', async () => {
			await api
				.as('member2')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectError(403, 'must be either moderator or owner'));
		});

		it('should succeed when listing as owner', async () => {
			await api
				.as('member')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
		});

		it('should succeed when listing as moderator', async () => {
			await api
				.as('moderator')
				.get('/v1/releases/' + release.id + '/moderate/comments')
				.then(res => res.expectStatus(200));
		});

	});

});