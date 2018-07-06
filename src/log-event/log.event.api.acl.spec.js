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

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The ACLs of the `Log Event` API', function() {

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

		it('should allow to list events', function(done) {
			request.get('/api/v1/events').end(hlp.status(200, done));
		});

		it('should deny to list starred events', function(done) {
			request.get('/api/v1/events?starred').end(hlp.status(401, done));
		});

		it('should allow to list per game', function(done) {
			request.get('/api/v1/games/1234/events').end(hlp.status(404, done));
		});

		it('should allow to list per release', function(done) {
			request.get('/api/v1/releases/1234/events').end(hlp.status(404, done));
		});

		it('should deny access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').end(hlp.status(401, done));
		});

		it('should deny access to events by current user', function(done) {
			request.get('/api/v1/user/events').end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow to list starred events', function(done) {
			request.get('/api/v1/events?starred').as('member').end(hlp.status(200, done));
		});

		it('should deny access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').as('member').end(hlp.status(401, done));
		});

		it('should allow access to events by current user', function(done) {
			request.get('/api/v1/user/events').as('member').end(hlp.status(200, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should allow to list starred events', function(done) {
			request.get('/api/v1/events?starred').as('contributor').end(hlp.status(200, done));
		});

		it('should deny access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').as('contributor').end(hlp.status(401, done));
		});

		it('should allow access to events by current user', function(done) {
			request.get('/api/v1/user/events').as('contributor').end(hlp.status(200, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow to list starred events', function(done) {
			request.get('/api/v1/events?starred').as('moderator').end(hlp.status(200, done));
		});

		it('should deny access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').as('moderator').end(hlp.status(401, done));
		});

		it('should allow access to events by current user', function(done) {
			request.get('/api/v1/user/events').as('moderator').end(hlp.status(200, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should allow to list starred events', function(done) {
			request.get('/api/v1/events?starred').as('admin').end(hlp.status(200, done));
		});

		it('should allow access to events by current user', function(done) {
			request.get('/api/v1/user/events').as('admin').end(hlp.status(200, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow to list starred events', function(done) {
			request.get('/api/v1/events?starred').as('root').end(hlp.status(200, done));
		});

		it('should allow access to events by user', function(done) {
			request.get('/api/v1/users/1234/events').as('root').end(hlp.status(404, done));
		});

		it('should allow access to events by current user', function(done) {
			request.get('/api/v1/user/events').as('root').end(hlp.status(200, done));
		});
	});

});