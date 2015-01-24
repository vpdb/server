"use strict"; /* global describe, before, after, it */

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');
var faker = require('faker');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Comment` API', function() {

	describe('when creating a new comment', function() {

		var release;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.release.createRelease('contributor', request, function(r) {
					release = r;
					done(null, release);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when posting for an non-existing release', function(done) {
			request
				.post('/api/v1/releases/bezerrrrk/comments')
				.as('member')
				.send({ message: '123' })
				.end(hlp.status(404, done));
		});

		it('should fail when posting an empty message', function(done) {
			request
				.post('/api/v1/releases/' + release.id + '/comments')
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'message', 'must provide a message');
					done();
				});
		});

		it('should succeed when posting correct data', function(done) {
			var msg = faker.company.catchPhrase();
			request
				.post('/api/v1/releases/' + release.id + '/comments')
				.save({ path: 'releases/create-comment'})
				.as('member')
				.send({ message: msg })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.from.id).to.be(hlp.getUser('member').id);
					expect(res.body.message).to.be(msg);
					done();
				});
		});

		it('should list a comment under the release after creation', function(done) {
			var msg = faker.company.catchPhrase();
			request.post('/api/v1/releases/' + release.id + '/comments').as('member').send({ message: msg })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.get('/api/v1/releases/' + release.id + '/comments').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body).to.be.an('array');
						expect(res.body[0].message).to.be(msg);
						done();
					});
				});
		});

	});

});