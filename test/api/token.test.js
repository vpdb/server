/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict"; /* global describe, before, after, it */

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../modules/superagent-test');
const hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Token` API', function() {

	describe('when creating a new personal token with scope "all"', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				admin: { roles: [ 'admin' ], _plan: 'subscribed' },
				subscribed: { roles: [ 'member' ], _plan: 'subscribed' },
				free: { roles: [ 'member' ], _plan: 'free' }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if no password provided', function(done) {
			request
				.post('/api/v1/tokens')
				.saveResponse({ path: 'tokens/create'})
				.as('subscribed')
				.send({ label: 'Test Application', type: 'personal', scopes: [ 'all' ] })
				.end(hlp.status(401, 'without supplying a password', done));
		});

		it('should fail if an invalid password is provided', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: 'xxx', type: 'personal', scopes: [ 'all' ] })
				.end(hlp.status(401, 'wrong password', done));
		});

		it('should fail if an invalid type is provided', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: hlp.getUser('subscribed').password, type: 'xxx', scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'type', 'not a valid enum value');
					done();
				});
		});

		it('should fail if no scope is provided', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'scopes', 'scopes are required');
					done();
				});
		});

		it('should fail if an invalid scope is provided', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: hlp.getUser('subscribed').password, scopes: [ 'bürz' ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'scopes', 'must be one or more of the following');
					done();
				});
		});

		it('should fail validations for empty label', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.set('User-Agent', '')
				.send({ password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'x', password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must contain at least');
					done();
				});
		});

		it('shoud fail when subscription plan is missing access token permissions', function(done) {
			request
				.post('/api/v1/tokens')
				.as('free')
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'all' ] })
				.end(hlp.status(401, 'current plan', done));
		});

		it('should succeed with valid data', function(done) {
			request
				.post('/api/v1/tokens')
				.save({ path: 'tokens/create'})
				.as('subscribed')
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.id).to.be.ok();
					expect(res.body.token).to.be.ok();
					done();
				});
		});

	});

	describe('when creating a new personal token with scope "login"', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				subscribed: { roles: [ 'member' ], _plan: 'subscribed' }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if no password provided while using a refresh token', function(done) {
			request.get('/api/v1/ping').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				const token = res.headers['x-token-refresh'];
				request
					.post('/api/v1/tokens')
					.set('Authorization', 'Bearer ' + token)
					.send({ type: 'personal', scopes: [ 'login' ] })
					.end(hlp.status(401, 'must provide your password', done));
			});
		});

		it('should fail if no password provided while using an access token', function(done) {

			// create access token
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ password: hlp.getUser('subscribed').password, scopes: [ 'all' ] })
				.end(function(err, res) {

					hlp.expectStatus(err, res, 201);
					const token = res.body.token;

					// use access token for login token
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'personal', scopes: [ 'login' ] })
						.end(hlp.status(401, 'must provide your password', done));
				});
		});

		it('should fail if an invalid password is provided even when using a non-refreshed token', function(done) {

			request
				.post('/api/v1/authenticate')
				.save({ path: 'auth/local' })
				.send({ username: hlp.getUser('member').name, password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					const token = res.body.token;
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ password: 'i-am-wrong', type: 'personal', scopes: [ 'login' ] })
						.end(hlp.status(401, done));
				});
		});

		it('should fail without password while using a JWT obtained through another login token', function(done) {

			// create first login token
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ scopes: [ 'login' ] })
				.end(function(err, res) {

					hlp.expectStatus(err, res, 201);
					const loginToken = res.body.token;

					// create jwt with login token
					request
						.post('/api/v1/authenticate')
						.send({ token: loginToken })
						.end(function(err, res) {

							hlp.expectStatus(err, res, 200);
							const jwt = res.body.token;

							// try to create another login token
							request
								.post('/api/v1/tokens')
								.set('Authorization', 'Bearer ' + jwt)
								.send({ type: 'personal', scopes: [ 'login' ] })
								.end(hlp.status(401, 'must provide your password', done));
						});
				});
		});

		it('should succeed when providing a password while using a refresh token', function(done) {
			request.get('/api/v1/ping').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				const token = res.headers['x-token-refresh'];
				request
					.post('/api/v1/tokens')
					.set('Authorization', 'Bearer ' + token)
					.send({ password: hlp.getUser('member').password, type: 'personal', scopes: [ 'login' ] })
					.end(hlp.status(201, done));
			});
		});

		it('should succeed when providing a password while using an access token', function(done) {

			// create access token
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					const token = res.body.token;

					// use access token for login token
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ password: hlp.getUser('subscribed').password, type: 'personal', scopes: [ 'login' ] })
						.end(hlp.status(201, done));
				});
		});

		it('should succeed without password while using a non-refreshed JWT from user/pass', function(done) {

			request
				.post('/api/v1/authenticate')
				.save({ path: 'auth/local' })
				.send({ username: hlp.getUser('member').name, password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					const token = res.body.token;
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'personal', scopes: [ 'login' ] })
						.end(hlp.status(201, done));
				});
		});

		it('should succeed without password while using a non-refreshed JWT from OAuth', function(done) {

			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'github',
					profile: {
						provider: 'github',
						id: '11234',
						displayName: null,
						username: 'mockuser',
						profileUrl: 'https://github.com/mockuser',
						emails: [ { value: 'mockuser@vpdb.io' } ],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					hlp.doomUser(res.body.user.id);
				const token = res.body.token;
				request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'personal', scopes: [ 'login' ] })
						.end(hlp.status(201, done));
				});
		});
	});

	describe('when creating a new application token', () => {
		before(function(done) {
			hlp.setupUsers(request, {
				admin: { roles: ['admin'], _plan: 'subscribed' },
				subscribed: { roles: [ 'member' ], _plan: 'subscribed' },
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for without provider', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, type: 'application', scopes: [ 'community '] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'provider', 'provider is required');
					done();
				});
		});

		it('should fail for invalid provider', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, type: 'application', provider: 'yadayada', scopes: [ 'community '] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'provider', 'provider must be one of');
					done();
				});
		});

		it('should fail for existing but invalid scope', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, type: 'application', scopes: [ 'all '] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'scopes', 'scopes must be one or more of the following');
					request
						.post('/api/v1/tokens')
						.as('admin')
						.send({ label: 'Test Application', password: hlp.getUser('admin').password, type: 'application', scopes: [ 'login '] })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'scopes', 'scopes must be one or more of the following');
							done();
						});
				});
		});

		it('should fail for user without proper ACLs', done => {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: hlp.getUser('subscribed').password, provider: 'github', type: 'application', scopes: [ 'community'] })
				.end(hlp.status(401, done));
		});

		it('should succeed with valid data', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, provider: 'github', type: 'application', scopes: [ 'community'] })
				.end(hlp.status(201, done));
		});

	});

	describe('when checking a token', () => {
		before(function(done) {
			hlp.setupUsers(request, {
				admin: { roles: [ 'admin' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for a random string', done => {
			request
				.get('/api/v1/tokens/12345')
				.end(hlp.status(404, 'invalid token', done));
		});

		it('should fail for invalid application token', done => {
			request
				.get('/api/v1/tokens/663cc8bfff8112d28ed86b2853d9a9a8')
				.end(hlp.status(404, 'invalid token', done));
		});

		it('should return data for valid application token', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, provider: 'github', type: 'application', scopes: [ 'community', 'service' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.id).to.be.ok();
					expect(res.body.token).to.be.ok();
					request
						.get('/api/v1/tokens/' + res.body.token)
						.save({ path: 'tokens/view'})
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.label).to.be('Test Application');
							expect(res.body.type).to.be('application');
							expect(res.body.scopes).to.eql(['community', 'service']);
							expect(res.body.is_active).to.be(true);
							expect(res.body.provider).to.be('github');
							done();
						});
				});
		});

		it('should return data for valid provider token', done => {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'My Application', password: hlp.getUser('admin').password, type: 'personal', scopes: [ 'community' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.id).to.be.ok();
					expect(res.body.token).to.be.ok();
					request
						.get('/api/v1/tokens/' + res.body.token)
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.label).to.be('My Application');
							expect(res.body.type).to.be('personal');
							expect(res.body.scopes).to.eql(['community']);
							expect(res.body.is_active).to.be(true);
							expect(res.body.for_user).to.be(hlp.getUser('admin').id);
							done();
						});
				});
		});

		it('should return data for valid JWT', done => {
			request
				.get('/api/v1/tokens/' + hlp.getUser('admin').token)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.type).to.be('jwt');
					expect(res.body.scopes).to.eql(['all']);
					expect(res.body.is_active).to.be(true);
					expect(res.body.for_user).to.be(hlp.getUser('admin').id);
					done();
				});
		});
	});

	describe('when listing tokens', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				member1: { roles: ['member'], _plan: 'subscribed' },
				member2: { roles: ['member'], _plan: 'subscribed' },
				member3: { roles: ['member'], _plan: 'subscribed' }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should return the created token', function(done) {
			const label = 'My Application';
			request
				.post('/api/v1/tokens')
				.as('member1')
				.send({ label: label, password: hlp.getUser('member1').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.token).to.be.ok();
					request
						.get('/api/v1/tokens')
						.as('member1')
						.save({ path: 'tokens/list'})
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.be.an('array');
							expect(res.body).to.have.length(1);
							const token = res.body[0];
							expect(token.token).to.not.be.ok();
							expect(token.label).to.be(label);
							expect(token.is_active).to.be(true);
							done();
						});
				});
		});

		it('should only return owned token', function(done) {
			request
				.post('/api/v1/tokens')
				.as('member2')
				.send({ label: 'Member 1', password: hlp.getUser('member2').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.post('/api/v1/tokens')
						.as('member3')
						.send({ label: 'Member 2', password: hlp.getUser('member3').password, scopes: ['all'] })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 201);
							request
								.get('/api/v1/tokens')
								.as('member2')
								.save({ path: 'tokens/list'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 200);
									expect(res.body).to.be.an('array');
									expect(res.body).to.have.length(1);
									done();
								});
						});
				});
		});

		it('should deny access if plan configuration forbids it', function(done) {
			request.get('/api/v1/tokens').as('member').end(hlp.status(403, done));
		});
	});

	describe('when updating a token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				subscribed: { roles: [ 'member' ], _plan: 'subscribed' }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for invalid data', function(done) {
			// create
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('subscribed')
						.saveResponse({ path: 'tokens/patch'})
						.send({ label: '1', expires_at: 'foo' })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'label', 'must contain at least');
							hlp.expectValidationError(err, res, 'expires_at', 'cast to date failed');
							done();
						});
				});
		});

		it('should succeed for valid data', function(done) {
			// create
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					const soon = new Date(new Date().getTime() + 1000);
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('subscribed')
						.save({ path: 'tokens/patch'})
						.send({ label: 'My Renamed Application', expires_at: soon, is_active: false })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.label).to.be('My Renamed Application');
							expect(res.body.is_active).to.be(false);
							expect(new Date(res.body.expires_at).getTime()).to.be(soon.getTime());
							done();
						});
				});
		});

	});

	describe('when deleting a token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				member1: { roles: ['member'], _plan: 'subscribed' },
				member2: { roles: ['member'], _plan: 'subscribed' },
				member3: { roles: ['member'], _plan: 'subscribed' }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for a not owned token', function(done) {
			// create
			request
				.post('/api/v1/tokens')
				.as('member1')
				.send({ label: 'My Application', password: hlp.getUser('member1').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.token).to.be.ok();
					request
						.del('/api/v1/tokens/' + res.body.id)
						.as('member2')
						.end(hlp.status(404, done));
				});
		});

		it('should succeed for a valid id', function(done) {

			// create
			request
				.post('/api/v1/tokens')
				.as('member3')
				.send({ label: 'My Application', password: hlp.getUser('member3').password, scopes: ['all'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.token).to.be.ok();

					// check
					request
						.get('/api/v1/tokens')
						.as('member3')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							// delete
							request
								.del('/api/v1/tokens/' + res.body[0].id)
								.as('member3')
								.save({ path: 'tokens/del'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 204);

									// check
									request
										.get('/api/v1/tokens')
										.as('member3')
										.save({ path: 'tokens/list'})
										.end(function(err, res) {
											hlp.expectStatus(err, res, 200);
											expect(res.body).to.be.empty();
											done();
										});
								});
						});
				});
		});


	});

});