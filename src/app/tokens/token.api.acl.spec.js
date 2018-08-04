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

const superagentTest = require('../../test/legacy/superagent-test');
const hlp = require('../../test/legacy/helper');

superagentTest(request);

describe('The ACLs of the `Token` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ], _plan: 'subscribed' },
			contributor: { roles: [ 'contributor' ], _plan: 'subscribed' },
			moderator: { roles: [ 'moderator' ], _plan: 'subscribed' },
			admin: { roles: [ 'admin' ], _plan: 'subscribed' },
			root: { roles: [ 'root' ], _plan: 'subscribed' },
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should deny access to listing tokens', function(done) {
			request.get('/api/v1/tokens').end(hlp.status(401, done));
		});

		it('should deny access to creating tokens', function(done) {
			request.post('/api/v1/tokens').send({}).end(hlp.status(401, done));
		});

		it('should deny access to updating tokens', function(done) {
			request.patch('/api/v1/tokens/1234').send({}).end(hlp.status(401, done));
		});

		it('should deny access to deleting tokens', function(done) {
			request.del('/api/v1/tokens/1234').end(hlp.status(401, done));
		});

	});

	describe('for logged clients (role member)', function() {

		it('should allow access to listing tokens', function(done) {
			request.get('/api/v1/tokens').as('member').end(hlp.status(200, done));
		});

		it('should deny access to listing provider tokens', function(done) {
			request.get('/api/v1/tokens').query({ type: 'provider' }).as('member').end(hlp.status(403, done));
		});

		it('should allow access to creating tokens', function(done) {
			request.post('/api/v1/tokens').as('member').send({ password: hlp.getUser('member').password, scopes: [ 'all' ] }).end(hlp.status(201, done));
		});

		it('should allow access to updating tokens', function(done) {
			request.patch('/api/v1/tokens/1234').as('member').send({}).end(hlp.status(404, done));
		});

		it('should allow access to deleting tokens', function(done) {
			request.del('/api/v1/tokens/1234').as('member').end(hlp.status(404, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should deny access to listing provider tokens', function(done) {
			request.get('/api/v1/tokens').query({ type: 'provider' }).as('contributor').end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should deny access to listing provider tokens', function(done) {
			request.get('/api/v1/tokens').query({ type: 'provider' }).as('moderator').end(hlp.status(403, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should allow access to listing provider tokens', function(done) {
			request.get('/api/v1/tokens').query({ type: 'provider' }).as('admin').end(hlp.status(200, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow access to listing provider tokens', function(done) {
			request.get('/api/v1/tokens').query({ type: 'provider' }).as('root').end(hlp.status(200, done));
		});
	});

});