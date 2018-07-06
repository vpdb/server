"use strict"; /*global describe, before, after, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The ACLs of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
			admin2: { roles: [ 'admin' ]},
			moderator: { roles: [ 'moderator' ]},
			contributor: { roles: [ 'contributor' ]},
			member: { roles: [ 'member' ], _plan: 'subscribed'}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should allow access to root resource', function(done) {
			request.get('/api/v1/').end(hlp.status(200, done));
		});

		it('should deny access to user profile', function(done) {
			request.get('/api/v1/user').saveResponse({ path: 'user/view' }).end(hlp.status(401, done));
		});

		it('should deny access to user logs', function(done) {
			request.get('/api/v1/user/logs').end(hlp.status(401, done));
		});

		it('should deny updates of user profile', function(done) {
			request.patch('/api/v1/user').send({}).end(hlp.status(401, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').end(hlp.status(401, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441').end(hlp.status(401, done));
		});

		it('should deny access to file upload', function(done) {
			request.post('/storage/v1/files').end(hlp.status(401, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').end(hlp.status(200, done));
		});

		it('should deny access to release name creation', function(done) {
			request.get('/api/v1/games/test/release-name').send({}).end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').save({ path: 'user/view' }).as('member').end(hlp.status(200, done));
		});

		it('should allow access to user logs', function(done) {
			request.get('/api/v1/user/logs').as('member').end(hlp.status(200, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').as('member').end(hlp.status(403, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441').as('member').end(hlp.status(403, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('member').end(hlp.status(422, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('member').end(hlp.status(200, done));
		});

		it('should allow access to release name creation', function(done) {
			request.post('/api/v1/games/test/release-name').as('member').send({}).end(hlp.status(404, done));
		});

	});

	describe('for members with the `contributor` role', function() {

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').as('contributor').end(hlp.status(403, done));
		});

		it('should allow access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('contributor').end(hlp.status(200, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('contributor').send({}).end(hlp.status(403, done));
		});

	});

	describe('for members with the `moderator` role', function() {

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('moderator').end(hlp.status(200, done));
		});

		it('should deny access to roles list', function(done) {
			request.get('/api/v1/roles').as('moderator').end(hlp.status(403, done));
		});

		it('should allow access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('moderator').end(hlp.status(200, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('moderator').send({}).end(hlp.status(422, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('moderator').end(hlp.status(200, done));
		});

		it('should allow access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('moderator').send({}).end(hlp.status(404, done));
		});
	});

	describe('for administrators', function() {

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to roles list', function(done) {
			request.get('/api/v1/roles').as('admin').end(hlp.status(200, done));
		});

		it('should deny access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('admin').end(hlp.status(403, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('admin').send({}).end(hlp.status(422, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('admin').end(hlp.status(200, done));
		});

	});

	describe('for the root user', function() {

		it('should allow access to user profile', function(done) {
			request.get('/api/v1/user').as('root').end(hlp.status(200, done));
		});

		it('should allow access to roles list', function(done) {
			request.get('/api/v1/roles').as('root').end(hlp.status(200, done));
		});

		it('should allow access to ipdb query', function(done) {
			request.get('/api/v1/ipdb/4441?dryrun=1').as('root').end(hlp.status(200, done));
		});

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow access to ping', function(done) {
			request.get('/api/v1/ping').as('root').end(hlp.status(200, done));
		});


	});

});