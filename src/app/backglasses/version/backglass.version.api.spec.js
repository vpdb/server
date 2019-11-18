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

"use strict"; /* global describe, before, after, it */

const expect = require('expect.js');
const ApiClient = require('../../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `Backglass Version` API', () => {

	describe('when adding a new version to an existing release', () => {

		before(async () => {
			await api.setupUsers({
				member: { roles: ['member'] },
				member2: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			});
		});

		after(async () => await api.teardown());

		it('should fail for invalid backglass', async () => {
			await api.as('member')
				.post(`/v1/backglasses/dontexist/versions`, {})
				.then(res => res.expectError(404));
		});

		it('should fail when logged as a different user', async () => {
			const backglass = await api.releaseHelper.createDirectB2S('member');
			await api.as('member2')
				.post(`/v1/backglasses/${backglass.id}/versions`, {})
				.then(res => res.expectError(403, 'only moderators or authors of the backglass'));
		});

		it('should fail validations when providing no data', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {})
				.then(res => res.expectValidationErrors([
					['_file', 'must provide a file reference'],
					['version', 'must be provided'],
				]));
		});

		it('should fail validations when providing no version', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			const b2sFile = await api.fileHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					_file: b2sFile.id
				}).then(res => res.expectValidationErrors([
					['version', 'must be provided'],
				]));
		});

		it('should fail validations when providing an existing version', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			const b2sFile = await api.fileHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					version: '1.0',
					_file: b2sFile.id
				}).then(res => res.expectValidationErrors([
					['version', 'version already exists'],
				]));
		});

		it('should fail validations when providing no file reference', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					version: '2.0',
				}).then(res => res.expectValidationErrors([
					['_file', 'must provide a file reference'],
				]));
		});

		it('should fail validations when providing a wrong release date', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					released_at: { foo: 'bar '},
				}).then(res => res.expectValidationErrors([
					['released_at', 'Cast to Date failed'],
				]));
		});

		it('should fail validations when providing a non-existent file reference', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					version: '2.0',
					_file: 'idontexist',
				}).then(res => res.expectValidationErrors([
					['_file', 'no such file with ID'],
				]));
		});

		it('should fail validations when providing a file of wrong type', async () => {
			const user = 'member';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			const rom = await api.fileHelper.createRom(user);
			await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					version: '2.0',
					_file: rom.id,
				}).then(res => res.expectValidationErrors([
					['_file', 'must be a backglass'],
				]));
		});

		it('should succeed with correct data', async () => {
			const date = new Date('2101-11-18');
			const user = 'moderator';
			const backglass = await api.releaseHelper.createDirectB2S(user);
			const b2sFile = await api.fileHelper.createDirectB2S(user, { keep: true });
			res = await api.as(user)
				.post(`/v1/backglasses/${backglass.id}/versions`, {
					version: '2.0',
					changes: '*Second release.*',
					released_at: date.toISOString(),
					_file: b2sFile.id
				}).then(res => res.expectStatus(201));
			expect(res.data.version).to.equal('2.0');

			// expect it by id
			res = await api.get(`/v1/backglasses/${backglass.id}`)
				.then(res => res.expectStatus(200));

			expect(res.data.versions).to.have.length(2);
			expect(res.data.versions[1].version).to.equal('1.0');
			expect(res.data.versions[0].version).to.equal('2.0');
			expect(res.data.versions[0].changes).to.equal('*Second release.*');
			expect(new Date(res.data.versions[0].released_at).getTime()).to.equal(date.getTime());
			expect(res.data.versions[0].file.id).to.equal(b2sFile.id);

			res = await api.get(`/v1/games/${backglass.game.id}`)
				.then(res => res.expectStatus(200));

			// expect it under game
			expect(res.data.backglasses[0].id).to.equal(backglass.id);
			expect(res.data.backglasses[0].versions[0].version).to.equal('2.0');
			expect(res.data.backglasses[0].versions[0].changes).to.equal('*Second release.*');
			expect(res.data.backglasses[0].versions[0].file.id).to.equal(b2sFile.id);
		});
	});
});
