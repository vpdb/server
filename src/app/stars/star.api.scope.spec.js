"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/legacy/superagent-test');
const hlp = require('../../test/legacy/helper');

superagentTest(request);

describe('The scopes of the `Star` API', function() {

	let tokenAll, tokenLogin, tokenCommunity, tokenService;
	before(function() {

		return Promise.promisify(hlp.setupUsers.bind(hlp))(request, { root: { roles: [ 'root' ],  _plan: 'vip' } })
			.then(() => {
				return request
					.post('/api/v1/tokens')
					.as('root')
					.send({ label: 'all-token', password: hlp.getUser('root').password, type: 'personal', scopes: ['all'] })
					.promise();

			}).then(res => {
				hlp.expectStatus(res, 201);
				expect(res.body.id).to.be.ok();
				expect(res.body.token).to.be.ok();
				tokenAll = res.body.token;
				return request
					.post('/api/v1/tokens')
					.as('root')
					.send({ label: 'login-token', password: hlp.getUser('root').password, type: 'personal', scopes: ['login'] })
					.promise();

			}).then(res => {
				hlp.expectStatus(res, 201);
				expect(res.body.id).to.be.ok();
				expect(res.body.token).to.be.ok();
				tokenLogin = res.body.token;
				return request
					.post('/api/v1/tokens')
					.as('root')
					.send({ label: 'community-token', password: hlp.getUser('root').password, type: 'personal', scopes: [ 'community' ] })
					.promise();

			}).then(res => {
				hlp.expectStatus(res, 201);
				expect(res.body.id).to.be.ok();
				expect(res.body.token).to.be.ok();
				tokenCommunity = res.body.token;
				return request
					.post('/api/v1/tokens')
					.as('root')
					.send({ label: 'service-token', password: hlp.getUser('root').password, provider: 'github', type: 'provider', scopes: [ 'service' ] })
					.promise();

			}).then(res => {
				hlp.expectStatus(res, 201);
				expect(res.body.id).to.be.ok();
				expect(res.body.token).to.be.ok();
				tokenService = res.body.token;
			});
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('using an "all" token', function() {

		it('should allow access to game star creation', done => {
			request.post('/api/v1/games/1234/star').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to game star deletion', done => {
			request.del('/api/v1/games/1234/star').with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to game star retrieval', done => {
			request.get('/api/v1/games/1234/star').with(tokenAll).end(hlp.status(404, done));
		});

		it('should allow access to media star creation', done => {
			request.post('/api/v1/media/1234/star').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to media star deletion', done => {
			request.del('/api/v1/media/1234/star').with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to media star retrieval', done => {
			request.get('/api/v1/media/1234/star').with(tokenAll).end(hlp.status(404, done));
		});

		it('should allow access to release star creation', done => {
			request.post('/api/v1/releases/1234/star').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to release star deletion', done => {
			request.del('/api/v1/releases/1234/star').with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to release star retrieval', done => {
			request.get('/api/v1/releases/1234/star').with(tokenAll).end(hlp.status(404, done));
		});

	});

	describe('using a login token', function() {

		it('should deny access to game star creation', done => {
			request.post('/api/v1/games/1234/star').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game star deletion', done => {
			request.del('/api/v1/games/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game star retrieval', done => {
			request.get('/api/v1/games/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to media star creation', done => {
			request.post('/api/v1/media/1234/star').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to media star deletion', done => {
			request.del('/api/v1/media/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to media star retrieval', done => {
			request.get('/api/v1/media/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release star creation', done => {
			request.post('/api/v1/releases/1234/star').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release star deletion', done => {
			request.del('/api/v1/releases/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release star retrieval', done => {
			request.get('/api/v1/releases/1234/star').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
	});

	describe('using a community token', function() {

		it('should allow access to game star creation', done => {
			request.post('/api/v1/games/1234/star').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to game star deletion', done => {
			request.del('/api/v1/games/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to game star retrieval', done => {
			request.get('/api/v1/games/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});

		it('should allow access to media star creation', done => {
			request.post('/api/v1/media/1234/star').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to media star deletion', done => {
			request.del('/api/v1/media/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to media star retrieval', done => {
			request.get('/api/v1/media/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});

		it('should allow access to release star creation', done => {
			request.post('/api/v1/releases/1234/star').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to release star deletion', done => {
			request.del('/api/v1/releases/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to release star retrieval', done => {
			request.get('/api/v1/releases/1234/star').with(tokenCommunity).end(hlp.status(404, done));
		});
	});

	describe('using a service token', function() {

		it('should deny access to game star creation', done => {
			request.post('/api/v1/games/1234/star').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game star deletion', done => {
			request.del('/api/v1/games/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game star retrieval', done => {
			request.get('/api/v1/games/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to media star creation', done => {
			request.post('/api/v1/media/1234/star').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to media star deletion', done => {
			request.del('/api/v1/media/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to media star retrieval', done => {
			request.get('/api/v1/media/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release star creation', done => {
			request.post('/api/v1/releases/1234/star').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release star deletion', done => {
			request.del('/api/v1/releases/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release star retrieval', done => {
			request.get('/api/v1/releases/1234/star').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
	});
});