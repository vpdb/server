/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

describe('The ACLs of the `Build` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ], _plan: 'subscribed'},
			contributor: { roles: [ 'contributor' ]},
			moderator: { roles: [ 'moderator' ]},
			admin: { roles: [ 'admin' ]},
			root: { roles: [ 'root' ]},
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').end(hlp.status(200, done));
		});

		it('should deny access to create builds', function(done) {
			request.post('/api/v1/builds').send({}).end(hlp.status(401, done));
		});

		it('should deny access to delete builds', function(done) {
			request.del('/api/v1/builds/mybuild').saveResponse({ path: 'builds/del'}).end(hlp.status(401, done));
		});

		it('should deny access to update builds', function(done) {
			request.patch('/api/v1/builds/mybuild').send({}).end(hlp.status(401, done));
		});

	});

	describe('for logged clients (role member)', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('member').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('member').send({}).end(hlp.status(422, done));
		});

		it('should allow access to builds deletion', function(done) {
			request.del('/api/v1/builds/mybuild').as('member').end(hlp.status(404, done));
		});

		it('should deny access to update builds', function(done) {
			request.patch('/api/v1/builds/mybuild').as('member').send({}).end(hlp.status(403, done));
		});

	});

	describe('for members with the `contributor` role', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('contributor').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should deny to delete a build', function(done) {
			request.del('/api/v1/builds/10.0.0').as('contributor').end(hlp.status(403, done));
		});

		it('should deny access to update builds', function(done) {
			request.patch('/api/v1/builds/mybuild').as('contributor').send({}).end(hlp.status(403, done));
		});

	});

	describe('for members with the `moderator` role', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('moderator').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('moderator').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete a build', function(done) {
			request.del('/api/v1/builds/123456').as('moderator').end(hlp.status(404, done));
		});

		it('should allow access to update builds', function(done) {
			request.patch('/api/v1/builds/mybuild').as('moderator').send({}).end(hlp.status(404, done));
		});

	});

	describe('for members with the `admin` role', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('admin').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('admin').send({}).end(hlp.status(422, done));
		});

	});

	describe('for members with the `root` role', function() {

		it('should allow to list builds', function(done) {
			request.get('/api/v1/builds').as('root').end(hlp.status(200, done));
		});

		it('should allow to create builds', function(done) {
			request.post('/api/v1/builds').as('root').send({}).end(hlp.status(422, done));
		});

	});

});