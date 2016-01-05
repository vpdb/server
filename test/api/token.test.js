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

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Token` API', function() {

	describe('when creating a new access token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				subscribed: { roles: [ 'member' ], _plan: 'subscribed' }
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
				.send({ label: 'Test Application', type: 'access' })
				.end(hlp.status(401, 'without supplying a password', done));
		});

		it('should fail if an invalid password is provided', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Test Application', password: 'xxx', type: 'access' })
				.end(hlp.status(401, 'wrong password', done));
		});

		it('should fail validations for empty label', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.set('User-Agent', '')
				.send({ password: hlp.getUser('subscribed').password, type: 'access' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'x', password: hlp.getUser('subscribed').password, type: 'access' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must contain at least');
					done();
				});
		});

		it('should succeed with valid data', function(done) {
			request
				.post('/api/v1/tokens')
				.save({ path: 'tokens/create'})
				.as('subscribed')
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password, type: 'access' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.id).to.be.ok();
					expect(res.body.token).to.be.ok();
					done();
				});
		});

	});

	describe('when creating a new login token', function() {

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
				var token = res.headers['x-token-refresh'];
				request
					.post('/api/v1/tokens')
					.set('Authorization', 'Bearer ' + token)
					.send({ type: 'login' })
					.end(hlp.status(401, 'must provide your password', done));
			});
		});

		it('should fail if no password provided while using an access token', function(done) {

			// create access token
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.doomToken('subscribed', res.body.id);
					hlp.expectStatus(err, res, 201);
					var token = res.body.token;

					// use access token for login token
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'login' })
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
					var token = res.body.token;
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ password: 'i-am-wrong', type: 'login' })
						.end(hlp.status(401, done));
				});
		});

		it('should fail without password while using a JWT obtained through another login token', function(done) {

			// create first login token
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ type: 'login' })
				.end(function(err, res) {

					hlp.expectStatus(err, res, 201);
					hlp.doomToken(res.body.id);
					var loginToken = res.body.token;

					// create jwt with login token
					request
						.post('/api/v1/authenticate')
						.send({ token: loginToken })
						.end(function(err, res) {

							hlp.expectStatus(err, res, 200);
							var jwt = res.body.token;

							// try to create another login token
							request
								.post('/api/v1/tokens')
								.set('Authorization', 'Bearer ' + jwt)
								.send({ type: 'login' })
								.end(hlp.status(401, 'must provide your password', done));
						});
				});
		});

		it('should succeed when providing a password while using a refresh token', function(done) {
			request.get('/api/v1/ping').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				var token = res.headers['x-token-refresh'];
				request
					.post('/api/v1/tokens')
					.set('Authorization', 'Bearer ' + token)
					.send({ password: hlp.getUser('member').password, type: 'login' })
					.end(hlp.status(201, done));
			});
		});

		it('should succeed when providing a password while using an access token', function(done) {

			// create access token
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.doomToken('subscribed', res.body.id);
					hlp.expectStatus(err, res, 201);
					var token = res.body.token;

					// use access token for login token
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ password: hlp.getUser('subscribed').password, type: 'login' })
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
					var token = res.body.token;
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'login' })
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
					var token = res.body.token;
					request
						.post('/api/v1/tokens')
						.set('Authorization', 'Bearer ' + token)
						.send({ type: 'login' })
						.end(hlp.status(201, done));
				});
		});
	});

	describe('when listing auth tokens', function() {

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
			var label = 'My Application';
			request
				.post('/api/v1/tokens')
				.as('member1')
				.send({ label: label, password: hlp.getUser('member1').password })
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
							var token = res.body[0];
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
				.send({ label: 'Member 1', password: hlp.getUser('member2').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.post('/api/v1/tokens')
						.as('member3')
						.send({ label: 'Member 2', password: hlp.getUser('member3').password })
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

	describe('when updating an auth token', function() {

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
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password })
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
				.send({ label: 'My Application', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					var soon = new Date(new Date().getTime() + 1000);
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

	describe('when deleting an auth token', function() {

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
				.send({ label: 'My Application', password: hlp.getUser('member1').password })
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
				.send({ label: 'My Application', password: hlp.getUser('member3').password })
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