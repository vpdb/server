"use strict"; /*global describe, before, after, it*/

const request = require('superagent');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The ACLs of the `Rating` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ], _plan: 'subscribed'}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should deny access to game rating creation', function(done) {
			request.post('/api/v1/games/mb/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to game rating modification', function(done) {
			request.put('/api/v1/games/mb/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to game rating retrieval', function(done) {
			request.get('/api/v1/games/mb/rating').end(hlp.status(401, done));
		});

		it('should deny access to release rating creation', function(done) {
			request.post('/api/v1/releases/123/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to release rating modification', function(done) {
			request.put('/api/v1/releases/123/rating').send({ value: 1 }).end(hlp.status(401, done));
		});

		it('should deny access to release rating retrieval', function(done) {
			request.get('/api/v1/releases/123/rating').end(hlp.status(401, done));
		});

	});

	describe('for logged clients (role member)', function() {

		it('should allow access to game rating creation', function(done) {
			request.post('/api/v1/games/mb/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to game rating modification', function(done) {
			request.put('/api/v1/games/mb/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to game rating retrieval', function(done) {
			request.get('/api/v1/games/mb/rating').as('member').end(hlp.status(404, done));
		});

		it('should allow access to release rating creation', function(done) {
			request.post('/api/v1/releases/123456/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to release rating modification', function(done) {
			request.put('/api/v1/releases/123456/rating').as('member').send({ value: 1 }).end(hlp.status(404, done));
		});

		it('should allow access to release rating retrieval', function(done) {
			request.get('/api/v1/releases/123456/rating').as('member').end(hlp.status(404, done));
		});
	});

});