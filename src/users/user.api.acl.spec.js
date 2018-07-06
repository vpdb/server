/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The ACLs of the `User` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ], _plan: 'subscribed'},
			contributor: { roles: [ 'contributor' ]},
			moderator: { roles: [ 'moderator' ]},
			admin: { roles: [ 'admin' ]},
			admin2: { roles: [ 'admin' ]},
			root: { roles: [ 'root' ]},
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').saveResponse({ path: 'users/list' }).end(hlp.status(401, done));
		});

		it('should deny access to user search', function(done) {
			request.get('/api/v1/users?q=123').end(hlp.status(401, done));
		});

		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).end(hlp.status(401, 'unauthorized', done));
		});

		it('should deny access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).saveResponse({ path: 'users/view' }).send({}).end(hlp.status(401, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).saveResponse({ path: 'users/update' }).send({}).end(hlp.status(401, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').saveResponse({ path: 'users/del' }).end(hlp.status(401, done));
		});

		it('should deny access to registration mail', function(done) {
			request.post('/api/v1/users/123/send-confirmation').send({}).end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').as('member').saveResponse({ path: 'users/list' }).end(hlp.status(403, done));
		});

		it('should deny access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('member').end(hlp.status(403, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('member').end(hlp.status(200, done));
		});

		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).as('member').end(hlp.status(401, done));
		});

		it('should only return minimal user info when searching other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('member')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should allow access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('member').send({}).end(hlp.status(200, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('member').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').saveResponse({ path: 'users/del' }).as('member').end(hlp.status(403, done));
		});

		it('should deny access to registration mail', function(done) {
			request.post('/api/v1/users/123/send-confirmation').send({}).as('member').end(hlp.status(403, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').as('contributor').end(hlp.status(403, done));
		});

		it('should deny access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('contributor').end(hlp.status(403, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).as('contributor').end(hlp.status(401, done));
		});

		it('should only return minmal user info when searching other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('contributor')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should allow access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('contributor').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/' + hlp.getUser('member').id).as('contributor').end(hlp.status(403, done));
		});

		it('should deny access to registration mail', function(done) {
			request.post('/api/v1/users/123/send-confirmation').send({}).as('contributor').end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should deny access to user list', function(done) {
			request.get('/api/v1/users').as('moderator').end(hlp.status(403, done));
		});

		it('should deny access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('moderator').end(hlp.status(403, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('moderator').end(hlp.status(200, done));
		});

		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).as('moderator').end(hlp.status(401, done));
		});

		it('should only return minimal user info when searching other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('moderator')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.not.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should allow access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('moderator').end(hlp.status(200, done));
		});

		it('should deny access to user update', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('moderator').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/' + hlp.getUser('member').id).as('moderator').end(hlp.status(403, done));
		});

		it('should deny access to registration mail', function(done) {
			request.post('/api/v1/users/123/send-confirmation').send({}).as('moderator').end(hlp.status(403, done));
		});

	});

	describe('for members with the `admin` role', function() {

		it('should allow to list users', function(done) {
			request.get('/api/v1/users').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('admin').end(hlp.status(200, done));
		});

		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).as('admin').end(hlp.status(401, done));
		});

		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('admin')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should grant access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('admin').send({}).end(hlp.status(200, done));
		});

		it('should allow user update of non-admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('admin').send({}).end(hlp.status(422, done));
		});

		it('should grant access to registration mail', function(done) {
			request.post('/api/v1/users/' + hlp.getUser('member').id + '/send-confirmation').send({}).as('admin').end(hlp.status(400, done));
		});

		it('should deny user update of admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin2').id).as('admin').send({ email: 'test@vpdb.io' }).end(hlp.status(403, done));
		});

		it('should deny user update himself', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin').id).as('admin').send({}).end(hlp.status(403, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').as('admin').end(hlp.status(403, done));
		});

		it('should allow access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').as('admin').end(hlp.status(404, done));
		});

	});

	describe('for members with the `root` role', function() {
		it('should allow to list users', function(done) {
			request.get('/api/v1/users').as('root').end(hlp.status(200, done));
		});
		it('should allow access to user search for less than 3 chars', function(done) {
			request.get('/api/v1/users?q=12').as('root').end(hlp.status(200, done));
		});
		it('should allow access to user search for more than 2 chars', function(done) {
			request.get('/api/v1/users?q=123').as('root').end(hlp.status(200, done));
		});
		it('should deny access to user creation through provider', done => {
			request.put('/api/v1/users').send({}).as('root').end(hlp.status(401, done));
		});
		it('should return detailed user info when listing other users', function(done) {
			request
				.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
				.as('root')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.length).to.be.above(0);
					expect(res.body[0]).to.have.property('email');
					expect(res.body[0]).to.have.property('name');
					done();
				});
		});

		it('should grant access to user details', function(done) {
			request.get('/api/v1/users/' + hlp.getUser('member').id).as('root').send({}).end(hlp.status(200, done));
		});

		it('should allow user update of non-admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('member').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow user update of admin', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('admin').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow update himself', function(done) {
			request.put('/api/v1/users/' + hlp.getUser('root').id).as('root').send({}).end(hlp.status(422, done));
		});

		it('should deny access to user delete', function(done) {
			request.del('/api/v1/users/1234567890abcdef').as('root').end(hlp.status(403, done));
		});

	});

});