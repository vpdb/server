"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The ACLs of the `Star` API', function() {

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

		it('should deny access to release unstarring', function(done) {
			request.del('/api/v1/releases/123/star').end(hlp.status(401, done));
		});

		it('should deny access to release star retrieval', function(done) {
			request.get('/api/v1/releases/123/star').end(hlp.status(401, done));
		});

		it('should deny access to user starring', function(done) {
			request.post('/api/v1/users/123/star').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to user unstarring', function(done) {
			request.del('/api/v1/users/123/star').end(hlp.status(401, done));
		});

		it('should deny access to user star retrieval', function(done) {
			request.get('/api/v1/users/123/star').end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should deny access to release starring', function(done) {
			request.post('/api/v1/releases/123/star').as('member').send({}).end(hlp.status(404, done));
		});

		it('should deny access to release unstarring', function(done) {
			request.del('/api/v1/releases/123/star').as('member').end(hlp.status(404, done));
		});

		it('should deny access to release star retrieval', function(done) {
			request.get('/api/v1/releases/123/star').as('member').end(hlp.status(404, done));
		});

		it('should deny access to user starring', function(done) {
			request.post('/api/v1/users/123/star').as('member').send({}).end(hlp.status(404, done));
		});

		it('should deny access to user unstarring', function(done) {
			request.del('/api/v1/users/123/star').as('member').end(hlp.status(404, done));
		});

		it('should deny access to release star retrieval', function(done) {
			request.get('/api/v1/users/123/star').as('member').end(hlp.status(404, done));
		});
	});

});