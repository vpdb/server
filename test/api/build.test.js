"use strict"; /* global describe, before, after, it */

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Build` API', function() {

	describe('when posting a new build', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail validations for empty data', function(done) {
			request
				.post('/api/v1/builds')
				.saveResponse({ path: 'builds/create'})
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'platform', 'must be provided');
					hlp.expectValidationError(err, res, 'label', 'must be provided');
					hlp.expectValidationError(err, res, 'type', 'must be provided');
					hlp.expectValidationError(err, res, 'major_version', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/builds')
				.saveResponse({ path: 'builds/create'})
				.as('member')
				.send({ platform: 'zurg', label: '1', type: 'non-existent', is_range: null, built_at: 'no-date' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'platform', 'invalid platform');
					hlp.expectValidationError(err, res, 'label', 'must contain at least');
					hlp.expectValidationError(err, res, 'type', 'invalid type');
					hlp.expectValidationError(err, res, 'is_range', 'you need to provide');
					done();
				});
		});

		it('should fail if the build label already exists', function(done) {
			request
				.post('/api/v1/builds')
				.as('member')
				.send({ label: 'v1.0.0-dupetest', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomBuild('member', res.body.id);
					request
						.post('/api/v1/builds')
						.as('member')
						.send({ label: 'v1.0.0-dupetest', type: 'release', major_version: '1' })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'label', 'is already taken');
							done();
						});
				});
		});

		it('should succeed with minimal data', function(done) {
			request
				.post('/api/v1/builds')
				.as('member')
				.send({ label: 'v1.0.0', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomBuild('member', res.body.id);
					done();
				});
		});

		it('should succeed with full data', function(done) {
			request
				.post('/api/v1/builds')
				.save({ path: 'builds/create'})
				.as('member')
				.send({
					label: 'v1.0.1',
					platform: 'vp',
					major_version: '1',
					type: 'release',
					description: 'The very first release.',
					download_url: 'http://download_url/',
					support_url: 'http://support_url/',
					built_at: '2000-01-01 12:21',
					is_range: false
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomBuild('member', res.body.id);
					done();
				});
		});
	});

	describe('when listing all builds', function() {

		it('should list the initially added builds', function(done) {
			request
				.get('/api/v1/builds')
				.save({ path: 'builds/list'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.not.be.empty();
					done();
				});
		});
	});

	describe('when deleting a build', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] },
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed as member and owner', function(done) {
			request
				.post('/api/v1/builds')
				.as('member')
				.send({ label: 'delete-test-1', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.del('/api/v1/builds/' + res.body.id)
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 204);
							done();
						});
				});
		});

		it('should fail as member and not owner', function(done) {
			request
				.post('/api/v1/builds')
				.as('contributor')
				.send({ label: 'delete-test-2', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomBuild('contributor', res.body.id);
					request
						.del('/api/v1/builds/' + res.body.id)
						.saveResponse({ path: 'builds/del'})
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 403);
							done();
						});
				});
		});

		it('should fail as contributor and not owner', function(done) {
			request
				.post('/api/v1/builds')
				.as('member')
				.send({ label: 'delete-test-3', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.del('/api/v1/builds/' + res.body.id)
						.as('contributor')
						.end(hlp.status(403, done));
				});

		});

		it('should succeed as moderator and not owner', function(done) {
			request
				.post('/api/v1/builds')
				.as('member')
				.send({ label: 'delete-test-4', type: 'release', platform: 'vp', major_version: '1' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.del('/api/v1/builds/' + res.body.id)
						.as('moderator')
						.end(hlp.status(204, done));
				});

		});

	});

});