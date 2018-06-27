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

describe('The ACLs of the `Tag` API', function() {

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

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').end(hlp.status(200, done));
		});

		it('should deny access to create tags', function(done) {
			request.post('/api/v1/tags').send({}).end(hlp.status(401, done));
		});

		it('should deny access to delete tags', function(done) {
			request.del('/api/v1/tags/mytag').saveResponse({ path: 'tags/del'}).end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('member').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('member').end(hlp.status(422, done));
		});

		it('should allow access to tag deletion', function(done) {
			request.del('/api/v1/tags/mytag').as('member').end(hlp.status(404, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('contributor').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('contributor').end(hlp.status(422, done));
		});

		it('should deny to delete a tag', function(done) {
			request.del('/api/v1/tags/hd').as('contributor').end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('moderator').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('moderator').end(hlp.status(422, done));
		});

		it('should allow to delete a tag', function(done) {
			request.del('/api/v1/tags/123456').as('moderator').end(hlp.status(404, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('admin').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('admin').end(hlp.status(422, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow to list tags', function(done) {
			request.get('/api/v1/tags').as('root').end(hlp.status(200, done));
		});

		it('should allow to create tags', function(done) {
			request.post('/api/v1/tags').send({}).as('root').end(hlp.status(422, done));
		});
	});

});