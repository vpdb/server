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

describe('The ACLs of the `Game` API', function() {

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

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').end(hlp.status(404, done));
		});

		it('should deny access to game creation', function(done) {
			request.post('/api/v1/games').send({}).end(hlp.status(401, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').end(hlp.status(401, done));
		});

		it('should deny access to release name creation', function(done) {
			request.get('/api/v1/games/test/release-name').send({}).end(hlp.status(401, done));
		});
	});

	describe('for logged clients (role member)', function() {

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('member').end(hlp.status(404, done));
		});

		it('should deny access to game creation', function(done) {
			request.post('/api/v1/games').send({}).as('member').end(hlp.status(403, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').as('member').end(hlp.status(403, done));
		});

		it('should allow access to release name creation', function(done) {
			request.post('/api/v1/games/test/release-name').as('member').send({}).end(hlp.status(404, done));
		});
	});

	describe('for members with the `contributor` role', function() {

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('contributor').end(hlp.status(404, done));
		});

		it('should allow to create games', function(done) {
			request.post('/api/v1/games').send({}).as('contributor').end(hlp.status(422, done));
		});

		it('should deny to deleting a game', function(done) {
			request.del('/api/v1/games/mb').as('contributor').end(hlp.status(403, done));
		});

		it('should deny access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('contributor').send({}).end(hlp.status(403, done));
		});
	});

	describe('for members with the `moderator` role', function() {

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('moderator').end(hlp.status(404, done));
		});

		it('should allow to create games', function(done) {
			request.post('/api/v1/games').send({}).as('moderator').end(hlp.status(422, done));
		});

		it('should allow deleting a game', function(done) {
			request.del('/api/v1/games/mb').as('moderator').end(hlp.status(404, done));
		});

		it('should allow access to release moderation', function(done) {
			request.post('/api/v1/releases/1234/moderate').as('moderator').send({}).end(hlp.status(404, done));
		});
	});

	describe('for members with the `admin` role', function() {

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('admin').end(hlp.status(404, done));
		});

		it('should deny to create games', function(done) {
			request.post('/api/v1/games').send({}).as('admin').end(hlp.status(403, done));
		});

		it('should deny access to game deletion', function(done) {
			request.del('/api/v1/games/mb').as('admin').end(hlp.status(403, done));
		});
	});

	describe('for members with the `root` role', function() {

		it('should allow check for existing games', function(done) {
			request.head('/api/v1/games/mb').as('root').end(hlp.status(404, done));
		});

		it('should allow to create games', function(done) {
			request.post('/api/v1/games').send({}).as('root').end(hlp.status(422, done));
		});

		it('should allow to delete a game', function(done) {
			request.del('/api/v1/games/mb').as('root').end(hlp.status(404, done));
		});
	});

});