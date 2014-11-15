"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The quota engine of VPDB', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			contributor: { roles: [ 'contributor' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when downloading a chargeable item', function() {

		it('should return rate status in the HTTP header', function(done) {

			hlp.release.createRelease('contributor', request, function(release) {
				request
					.get('/storage/v1/' + release.versions[0].files[0]._file.id)
					.as('member')
					.query({ jwt: request.tokens.member })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['x-ratelimit-limit']).to.be.ok();
						expect(res.headers['x-ratelimit-remaining']).to.be.ok();
						expect(res.headers['x-ratelimit-reset']).to.be.ok();
						done();
					});
			});
		});
	});

});
