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

describe('The ACLs of the `File Storage` API', function() {

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

		it('should deny access to file upload', function(done) {
			request.post('/storage/v1/files').end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('member').end(hlp.status(422, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('contributor').send({}).end(hlp.status(422, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('moderator').send({}).end(hlp.status(422, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('admin').send({}).end(hlp.status(422, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow access to file upload', function(done) {
			request.post('/storage/v1/files').as('root').send({}).end(hlp.status(422, done));
		});
	});

});