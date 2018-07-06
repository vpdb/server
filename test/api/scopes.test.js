"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../modules/superagent-test');
const hlp = require('../modules/helper');

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

		it('should deny access to authentication', done => {
			request.post('/api/v1/authenticate').send({}).with(tokenAll).end(hlp.status(400, 'token with "login" scope', done));
		});

		it('should allow access to ipdb info retrieval', done => {
			request.get('/api/v1/ipdb/1234?dryrun=1').with(tokenAll).end(hlp.status(200, done));
		});

		it('should allow access to roles retrieval', done => {
			request.get('/api/v1/roles').with(tokenAll).end(hlp.status(200, done));
		});

		it('should allow access to real-time subscription', done => {
			request.post('/api/v1/messages/authenticate').send({}).with(tokenAll).end(hlp.status(404, done));
		});

		it('should allow access to user profile', done => {
			request.get('/api/v1/user').with(tokenAll).end(hlp.status(200, done));
		});
		it('should allow access to user profile update', done => {
			request.patch('/api/v1/user').send({}).with(tokenAll).end(hlp.status(200, done));
		});
		it('should allow access to user log retrieval', done => {
			request.get('/api/v1/user/logs').with(tokenAll).end(hlp.status(200, done));
		});

	});

	describe('using a login token', function() {

		it('should deny access to authentication', done => {
			request.post('/api/v1/authenticate').send({}).with(tokenLogin).end(hlp.status(400, 'token with "login" scope', done));
		});

		it('should deny access to ipdb info retrieval', done => {
			request.get('/api/v1/ipdb/1234').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to roles retrieval', done => {
			request.get('/api/v1/roles').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to real-time subscription', done => {
			request.post('/api/v1/messages/authenticate').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release moderation creation', done => {
			request.post('/api/v1/releases/1234/moderate').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to user profile', done => {
			request.get('/api/v1/user').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to user profile update', done => {
			request.patch('/api/v1/user').send({}).with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to user log retrieval', done => {
			request.get('/api/v1/user/logs').with(tokenLogin).end(hlp.status(401, 'invalid scope', done));
		});

	});

	describe('using a community token', function() {

		it('should deny access to authentication', done => {
			request.post('/api/v1/authenticate').send({}).with(tokenCommunity).end(hlp.status(400, 'token with "login" scope', done));
		});

		it('should deny access to ipdb info retrieval', done => {
			request.get('/api/v1/ipdb/1234').with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to roles retrieval', done => {
			request.get('/api/v1/roles').with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to real-time subscription', done => {
			request.post('/api/v1/messages/authenticate').send({}).with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});

		it('should deny access to release moderation creation', done => {
			request.post('/api/v1/releases/1234/moderate').send({}).with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});

		it('should allow access to user profile', done => {
			request.get('/api/v1/user').with(tokenCommunity).end(hlp.status(200, done));
		});
		it('should deny access to user profile update', done => {
			request.patch('/api/v1/user').send({}).with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});
		it('should deny access to user log retrieval', done => {
			request.get('/api/v1/user/logs').with(tokenCommunity).end(hlp.status(401, 'invalid scope', done));
		});

	});


	describe('using a service token', function() {


	});
});