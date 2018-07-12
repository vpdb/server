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

describe('The ACLs of the `Release` API', function() {

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

		it('should allow to list releases', function(done) {
			request.get('/api/v1/releases').end(hlp.status(200, done));
		});

		it('should allow access to release details', function(done) {
			request.get('/api/v1/releases/123456').end(hlp.status(404, done));
		});

		it('should deny access to create releases', function(done) {
			request.post('/api/v1/releases').send({}).end(hlp.status(401, done));
		});

		it('should deny access to release deletion', function(done) {
			request.del('/api/v1/releases/123456').saveResponse({ path: 'releases/del' }).end(hlp.status(401, done));
		});

		it('should deny access to release version creation', function(done) {
			request.post('/api/v1/releases/123/versions').send({}).end(hlp.status(401, done));
		});

		it('should deny access to release file creation', function(done) {
			request.patch('/api/v1/releases/123/versions/1.2').send({}).end(hlp.status(401, done));
		});

		it('should deny access to release file validation', function(done) {
			request.post('/api/v1/releases/123/versions/1.2/files/1234/validate').send({}).end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow to list releases', function(done) {
			request.get('/api/v1/releases').as('member').end(hlp.status(200, done));
		});

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('member').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('member').end(hlp.status(404, done));
		});

		it('should deny access to release version creation', function(done) {
			request.post('/api/v1/releases/123/versions').as('member').send({}).end(hlp.status(404, done));
		});

		it('should deny access to release file creation', function(done) {
			request.patch('/api/v1/releases/123/versions/1.0').as('member').send({}).end(hlp.status(404, done));
		});

		it('should deny access to release file validation', function(done) {
			request.post('/api/v1/releases/123/versions/1.2/files/1234/validate').as('member').send({}).end(hlp.status(403, done));
		});

		it('should deny access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('member').send({}).end(hlp.status(403, done));
		});

	});

	describe('for members with the `contributor` role', function() {

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('contributor').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('contributor').end(hlp.status(404, done));
		});

		it('should deny access to release file validation', function(done) {
			request.post('/api/v1/releases/123/versions/1.2/files/1234/validate').as('contributor').send({}).end(hlp.status(403, done));
		});

		it('should deny access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('contributor').send({}).end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('moderator').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('moderator').end(hlp.status(404, done));
		});

		it('should allow access to release file validation', function(done) {
			request.post('/api/v1/releases/123/versions/1.2/files/1234/validate').as('moderator').send({}).end(hlp.status(404, done));
		});

		it('should allow access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('moderator').send({}).end(hlp.status(404, done));
		});

	});

	describe('for members with the `admin` role', function() {

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('admin').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('admin').end(hlp.status(404, done));
		});

		it('should deny access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('contributor').send({}).end(hlp.status(403, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow to create releases', function(done) {
			request.post('/api/v1/releases').as('root').send({}).end(hlp.status(422, done));
		});

		it('should allow to delete releases', function(done) {
			request.del('/api/v1/releases/123456').as('root').end(hlp.status(404, done));
		});

		it('should allow access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('root').send({}).end(hlp.status(404, done));
		});

	});

});