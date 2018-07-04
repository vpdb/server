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

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The VPDB `Release Version File` API', function() {

	let release;
	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: ['member'] },
			moderator: { roles: ['moderator', 'contributor'] }
		}, function() {
			var user = 'member';
			hlp.release.createRelease(user, request, function(r) {
				release = r;
				done();
			});
		});
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when validating a file of a release', function() {

		it('should fail for invalid release', function(done) {
			request
				.post('/api/v1/releases/doesnotexist/versions/doesnotexist/files/doesnotexist/validate')
				.as('moderator')
				.send({})
				.end(hlp.status(404, 'no such release', done));
		});

		it('should fail for invalid version', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/versions/doesnotexist/files/' + release.versions[0].files[0].file.id + '/validate')
				.as('moderator')
				.send({})
				.end(hlp.status(404, 'no such version', done));
		});

		it('should fail for invalid file', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/doesnotexist/validate')
				.as('moderator')
				.send({})
				.end(hlp.status(404, 'no file with id', done));
		});

		it('should fail for empty data', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate')
				.as('moderator')
				.send({})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(2);
					hlp.expectValidationError(err, res, 'status', 'must be provided');
					hlp.expectValidationError(err, res, 'message', 'must be provided');
					done();
				});
		});

		it('should fail for invalid status', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate')
				.as('moderator')
				.send({ message: 'Wrong status.', status: 'duh.' })
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'status', 'must be one of');
					done();
				});
		});

		it('should succeed for valid data', function(done) {
			const message = 'All validated, thanks!';
			const status = 'verified';
			request
				.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate')
				.as('moderator')
				.save({ path: 'releases/validate-file' })
				.send({ message: message, status: status })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.message).to.be(message);
					expect(res.body.status).to.be(status);
					expect(res.body.validated_at).to.be.ok();
					expect(res.body.validated_by).to.be.an('object');
					done();
				});
		});
	});

	describe.skip('when filtering releases by validation', function() {

		it('should filter a validated release', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files/' + release.versions[0].files[0].file.id + '/validate')
				.as('moderator')
				.send({ message: 'ok', status: 'verified' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					request.get('/api/v1/releases').as('moderator').query({ validation: 'verified' }).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.length).to.be(1);
						done();
					});
				});
		});

	});

});