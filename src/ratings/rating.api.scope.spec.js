"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The scopes of the VPDB API', function() {

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
					.send({ label: 'service-token', password: hlp.getUser('root').password, provider: 'github', type: 'application', scopes: [ 'service' ] })
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

		it('should allow access to game rating creation', done => {
			request.post('/api/v1/games/1234/rating').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to game rating update', done => {
			request.put('/api/v1/games/1234/rating').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to game rating retrieval', done => {
			request.get('/api/v1/games/1234/rating').with(tokenAll).end(hlp.status(404, done));
		});

		it('should allow access to release rating creation', done => {
			request.post('/api/v1/releases/1234/rating').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to release rating update', done => {
			request.put('/api/v1/releases/1234/rating').send({}).with(tokenAll).end(hlp.status(404, done));
		});
		it('should allow access to release rating retrieval', done => {
			request.get('/api/v1/releases/1234/rating').with(tokenAll).end(hlp.status(404, done));
		});

	});

	describe('using a login token', function() {

		it('should deny access to game rating creation', done => {
			request.post('/api/v1/games/1234/rating').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game rating update', done => {
			request.put('/api/v1/games/1234/rating').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game rating retrieval', done => {
			request.get('/api/v1/games/1234/rating').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release rating creation', done => {
			request.post('/api/v1/releases/1234/rating').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release rating update', done => {
			request.put('/api/v1/releases/1234/rating').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release rating retrieval', done => {
			request.get('/api/v1/releases/1234/rating').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

	});

	describe('using a community token', function() {

		it('should allow access to game rating creation', done => {
			request.post('/api/v1/games/1234/rating').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to game rating update', done => {
			request.put('/api/v1/games/1234/rating').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to game rating retrieval', done => {
			request.get('/api/v1/games/1234/rating').with(tokenCommunity).end(hlp.status(404, done));
		});

		it('should allow access to release rating creation', done => {
			request.post('/api/v1/releases/1234/rating').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to release rating update', done => {
			request.put('/api/v1/releases/1234/rating').send({}).with(tokenCommunity).end(hlp.status(404, done));
		});
		it('should allow access to release rating retrieval', done => {
			request.get('/api/v1/releases/1234/rating').with(tokenCommunity).end(hlp.status(404, done));
		});
	});

	describe('using a service token', function() {

		it('should deny access to game rating creation', done => {
			request.post('/api/v1/games/1234/rating').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game rating update', done => {
			request.put('/api/v1/games/1234/rating').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to game rating retrieval', done => {
			request.get('/api/v1/games/1234/rating').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release rating creation', done => {
			request.post('/api/v1/releases/1234/rating').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release rating update', done => {
			request.put('/api/v1/releases/1234/rating').send({}).with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to release rating retrieval', done => {
			request.get('/api/v1/releases/1234/rating').with(tokenService).end(hlp.status(401, 'invalid scope', done));
		});
	});
});