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
const ApiClient = require('../../../../test/api.client');
const api = new ApiClient();

let res;
describe('The VPDB `Release Version File` API', () => {

	describe('when validating a file of a release', () => {

		let release;
		before(async () => {
			await api.setupUsers({
				member: { roles: ['contributor'] },
				moderator: { roles: ['moderator'] }
			});
			release = await api.releaseHelper.createRelease('member');
		});

		after(async () => await api.teardown());

		it('should fail for invalid release', async () => {
			await api.as('moderator')
				.post('/v1/releases/doesnotexist/versions/doesnotexist/files/doesnotexist/validate', {})
				.then(res => res.expectError(404, 'no such release'));
		});

		it('should fail for invalid version', async () => {
			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/doesnotexist/files/' + release.versions[0].files[0].file.id + '/validate', {})
				.then(res => res.expectError(404, 'no such version'));
		});

		it('should fail for invalid file', async () => {
			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/doesnotexist/validate', {})
				.then(res => res.expectError(404, 'no file with id'));
		});

		it('should fail for empty data', async () => {
			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate', {})
				.then(res => res.expectValidationErrors([
					['status', 'must be provided'],
					['message', 'must be provided'],
				], 2));
		});

		it('should fail for invalid status', async () => {
			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate',
					{ message: 'Wrong status.', status: 'duh.' })
				.then(res => res.expectValidationErrors([
					['status', 'must be one of']
				], 1));
		});

		it('should succeed for valid data', async () => {
			const message = 'All validated, thanks!';
			const status = 'verified';
			res = await api.as('moderator')
				.save('releases/validate-file')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate',
					{ message: message, status: status })
				.then(res => res.expectStatus(200));
			expect(res.data.message).to.be(message);
			expect(res.data.status).to.be(status);
			expect(res.data.validated_at).to.be.ok();
			expect(res.data.validated_by).to.be.an('object');
		});
	});

	describe('when filtering releases by validation', () => {

		let release;
		before(async () => {
			await api.setupUsers({
				member: { roles: ['contributor'] },
				moderator: { roles: ['moderator'] }
			});
			release = await api.releaseHelper.createRelease('member');
		});

		after(async () => await api.teardown());

		it('should filter a validated release', async () => {
			res = await api
				.withQuery({ validation: 'none' })
				.get('/v1/releases')
				.then(res => res.expectStatus(200));
			expect(res.data.length).to.be(1);

			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate',
					{ message: 'ok', status: 'verified' })
				.then(res => res.expectStatus(200));

			res = await api.withQuery({ validation: 'verified' }).get('/v1/releases').then(res => res.expectStatus(200));
			expect(res.data.length).to.be(1);

			res = await api.withQuery({ validation: 'playable' }).get('/v1/releases').then(res => res.expectStatus(200));
			expect(res.data.length).to.be(0);

			res = await api.withQuery({ validation: 'none' }).get('/v1/releases').then(res => res.expectStatus(200));
			expect(res.data.length).to.be(0);
		});

		it('should filter a playable playable', async () => {
			await api.as('moderator')
				.post('/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate',
					{ message: 'ok', status: 'playable' })
				.then(res => res.expectStatus(200));

			res = await api.withQuery({ validation: 'playable' }).get('/v1/releases').then(res => res.expectStatus(200));
			expect(res.data.length).to.be(1);

			res = await api.withQuery({ validation: 'broken' }).get('/v1/releases').then(res => res.expectStatus(200));
			expect(res.data.length).to.be(0);
		});
	});
});
