/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

	describe('when creating a new token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if no password provided', function(done) {
			request
				.post('/api/v1/tokens')
				.saveResponse({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'Test Application' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401, 'must supply a password');
					done();
				});
		});

		it('should fail if the wrong password provided', function(done) {
			request
				.post('/api/v1/tokens')
				//.saveResponse({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'Test Application', password: 'xxx' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401, 'wrong password');
					done();
				});
		});

		it('should fail validations for empty label', function(done) {
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ label: 'x', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'label', 'must contain at least');
					done();
				});
		});

		it('should succeed with valid data', function(done) {
			request
				.post('/api/v1/tokens')
				.save({ path: 'tokens/create'})
				.as('member')
				.send({ label: 'My Application', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.id).to.be.ok();
					expect(res.body.token).to.be.ok();
					done();
				});
		});
	});

	describe('when listing auth tokens', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member1: { roles: ['member'] },
				member2: { roles: ['member'] },
				member3: { roles: ['member'] }
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
	});

	describe.only('when updating an auth token', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for invalid data', function(done) {
			// create
			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ label: 'My Application', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('member')
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
				.as('member')
				.send({ label: 'My Application', password: hlp.getUser('member').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					var soon = new Date(new Date().getTime() + 1000);
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('member')
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
				member1: { roles: ['member'] },
				member2: { roles: ['member'] },
				member3: { roles: ['member'] }
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