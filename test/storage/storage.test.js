"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');
var async = require('async');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The storage engine of VPDB', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			moderator: { roles: [ 'moderator' ]},
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('after successfully uploading a non-public file', function() {

		describe('when the file is still inactive', function() {



		});

		describe('when the file is active', function() {

			it('should deny access to anonymous users', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request.get(hlp.urlPath(fileUrl)).end(hlp.status(401, done, 'valid credentials'));
				});
			});

			it('should grant access to an authenticated user', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request.get(hlp.urlPath(fileUrl)).as('contributor').end(hlp.status(200, done));
				});
			});

			it('should grant access using a storage token', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request
						.post('/storage/v1/authenticate')
						.as('contributor')
						.save({ path: 'auth/storage' })
						.send({ paths: fileUrl })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.be.an('object');
							expect(res.body).to.have.key(fileUrl);
							request.get(hlp.urlPath(fileUrl)).query({ token: res.body[fileUrl] }).end(hlp.status(200, done));
						});
				});
			});

		});

		describe('when the file has a quota applied', function() {

			it('should contain the X-RateLimit- "Limit", "Remaining" and "Reset" headers');

			it('should grant access to the user if enough quota is available');

			it('should deny access to the user if no more quota is available');

			it('should ignore the quota if the user is the owner of the file');

		});

	});

});
