"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication logic of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ] },
			disabled: { roles: [ 'member' ], is_active: false }
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

	describe('when sending an authentication request', function() {

		it('should fail if no credentials are posted', function(done) {
			request
				.post('/api/authenticate')
				.send({})
				.end(hlp.status(400, 'must supply a username', done));
		});

		it('should fail if username is non-existent', function(done) {
			request
				.post('/api/authenticate')
				.send({ username: '_______________', password: 'xxx' })
				.end(hlp.status(401, 'Wrong username or password', done));
		});

		it('should fail if username exists but wrong password is supplied', function(done) {
			request
				.post('/api/authenticate')
				.send({ username: hlp.getUser('member').name, password: 'xxx' })
				.end(hlp.status(401, 'Wrong username or password', done));
		});

		it('should fail if credentials are correct but user is disabled', function(done) {
			request
				.post('/api/authenticate')
				.send({ username: hlp.getUser('disabled').name, password: hlp.getUser('disabled').password })
				.end(hlp.status(401, 'Inactive account', done));
		});

		it('should succeed if credentials are correct', function(done) {
			request
				.post('/api/authenticate')
				.send({ username: hlp.getUser('member').name, password: hlp.getUser('member').password })
				.end(hlp.status(200, done));
		});

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
				.get('/api/user')
				.query({ jwt: request.tokens.member })
				.end(hlp.status(200, done));
		});

		it('should fail if the token is corrupt or unreadable', function(done) {
			request
				.get('/api/user')
				.query({ jwt: 'abcd.123.xyz' })
				.end(hlp.status(401, 'Bad JSON Web Token', done));
		});
	});

});
