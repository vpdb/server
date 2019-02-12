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

describe('The ACLs of the `File` API', function() {

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

		it('should deny access to file deletion', function(done) {
			request.del('/api/v1/files/123456789').end(hlp.status(401, done));
		});

		it('should allow access to file details', function(done) {
			request.get('/api/v1/files/123456789').end(hlp.status(404, 'No such file', done));
		});

		it('should deny access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow access to file deletion', function(done) {
			request.del('/api/v1/files/123456789').as('member').end(hlp.status(404, done));
		});

		it('should allow access to file details', function(done) {
			request.get('/api/v1/files/123456789').as('member').end(hlp.status(404, done));
		});

		it('should deny access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').as('member').end(hlp.status(403, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should deny access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').as('contributor').end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').as('moderator').end(hlp.status(404, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should deny access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').as('admin').end(hlp.status(403, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow access to file block matches', function(done) {
			request.get('/api/v1/files/123456789/blockmatch').as('root').end(hlp.status(404, done));
		});
	});
});