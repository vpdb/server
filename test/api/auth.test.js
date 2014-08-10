"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication logic of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	it('should deny access to the user profile if there is neither a token in the header nor the URL', function(done) {
		request
			.get('/api/user')
			.end(hlp.status(401, done));
	});

	describe('when authorization is provided in the header', function() {

		it('should grant access to the user profile if the token is valid', function(done) {
			request
				.get('/api/user')
				.set('Authorization', 'Bearer ' + request.tokens.member)
				.end(hlp.status(200, done));
		});

		it('should fail if the authorization header has no type', function(done) {
			request
				.get('/api/user')
				.set('Authorization', request.tokens.member)
				.end(hlp.status(401, 'Bad Authorization header', done));
		});

		it('should fail if the authorization header has a different type than "Bearer"', function(done) {
			request
				.get('/api/user')
				.set('Authorization', 'Token ' + request.tokens.member)
				.end(hlp.status(401, 'Bad Authorization header', done));
		});

		it('should fail if the token is corrupt or unreadable', function(done) {
			request
				.get('/api/user')
				.set('Authorization', 'Bearer abcd.123.xyz')
				.end(hlp.status(401, 'Bad JSON Web Token', done));
		});
	});

	describe('when authorization is provided in the URL', function() {

		it('should grant access to the user profile if the token is valid', function(done) {
			request
				.get('/api/user?jwt=' + request.tokens.member)
				.end(hlp.status(200, done));
		});

		it('should fail if the token is corrupt or unreadable', function(done) {
			request
				.get('/api/user?jwt=abcd.123.xyz')
				.end(hlp.status(401, 'Bad JSON Web Token', done));
		});
	});

});
