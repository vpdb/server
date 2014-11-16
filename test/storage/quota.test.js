"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');
var async = require('async');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The quota engine of VPDB', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			ratetest1: { roles: [ 'member' ]},
			ratetest2: { roles: [ 'member' ]},
			contributor: { roles: [ 'contributor' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when downloading a chargeable item', function() {

		it('should return the correct rate in the HTTP header', function(done) {

			hlp.release.createRelease('contributor', request, function(release) {
				request
					.get('/storage/v1/' + release.versions[0].files[0]._file.id)
					.query({ jwt: request.tokens.ratetest1 })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['x-ratelimit-limit']).to.be.ok();
						expect(res.headers['x-ratelimit-remaining']).to.be.ok();
						expect(res.headers['x-ratelimit-reset']).to.be.ok();

						var limit = parseInt(res.headers['x-ratelimit-limit']);
						var remaining = parseInt(res.headers['x-ratelimit-remaining']);

						expect(limit - remaining).to.equal(1);
						done();
					});
			});
		});

		it('should refuse download if there is no more remaining rate', function(done) {

			hlp.release.createRelease('contributor', request, function(release) {
				async.timesSeries(4, function(n, next) {
					request
						.get('/storage/v1/' + release.versions[0].files[0]._file.id)
						.as('ratetest1')
						.query({ jwt: request.tokens.member })
						.end(function(err, res) {
							if (n < 3) {
								hlp.expectStatus(err, res, 200);
								expect(res.headers['x-ratelimit-limit']).to.be.ok();
								expect(res.headers['x-ratelimit-remaining']).to.be.ok();
								expect(res.headers['x-ratelimit-reset']).to.be.ok();

								var limit = parseInt(res.headers['x-ratelimit-limit']);
								var remaining = parseInt(res.headers['x-ratelimit-remaining']);

								expect(limit - remaining).to.equal(n + 1);
							} else {
								hlp.dump(res);
								hlp.expectStatus(err, res, 403);
							}
							next();
						});
				}, done);

			});
		});

	});

});
