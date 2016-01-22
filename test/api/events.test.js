/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

describe('The VPDB `event` API', function() {

	describe('when listing events', function() {

		var release;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.release.createRelease('member', request, function(r) {
					release = r;
					done(null, r);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list game and release creation events', function(done) {
			request
				.get('/api/v1/events')
				.save({ path: 'events/list'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(_.find(res.body, { event: 'create_release', payload: { release: { id: release.id } } })).to.be.ok();
					expect(_.find(res.body, { event: 'create_game', payload: { game: { id: release.game.id } } })).to.be.ok();
					done();
				});
		});

		it('should list release creation event', function(done) {
			request
				.get('/api/v1/releases/' + release.id + '/events')
				.save({ path: 'events/list-release'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(_.find(res.body, { event: 'create_release' })).to.be.ok();
					expect(_.find(res.body, { event: 'create_game' })).to.not.be.ok();
					done();
				});
		});

		it('should list game creation event', function(done) {
			request
				.get('/api/v1/games/' + release.game.id + '/events')
				.save({ path: 'events/list-game'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(_.find(res.body, { event: 'create_game' })).to.be.ok();
					expect(_.find(res.body, { event: 'create_release' })).to.be.ok();
					done();
				});
		});

		it('should filter game creation events', function(done) {
			request
				.get('/api/v1/events?events=create_game')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(_.find(res.body, { event: 'create_game' })).to.be.ok();
					expect(_.find(res.body, { event: 'create_release' })).to.not.be.ok();
					done();
				});
		});

		it('should filter non-game creation events', function(done) {
			request
				.get('/api/v1/events?events=!create_game')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(_.find(res.body, { event: 'create_game' })).to.not.be.ok();
					expect(_.find(res.body, { event: 'create_release' })).to.be.ok();
					done();
				});
		});

		it('should only list starred events', function(done) {

			// 1. check there's no result without star
			request
				.get('/api/v1/releases/' + release.id + '/events?starred')
				.as('member')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.be.empty();

					// 2. star
					request
						.post('/api/v1/releases/' + release.id + '/star')
						.send({})
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 201);

							// 3. check there's a result
							request
								.get('/api/v1/releases/' + release.id + '/events?starred')
								.as('member')
								.end(function(err, res) {
									hlp.expectStatus(err, res, 200);
									expect(res.body).to.be.an('array');
									expect(_.find(res.body, { event: 'create_release' })).to.be.ok();
									done();
								});
						});
				});
		});

		// todo
		it('should only list event after creating a comment');
		it('should only list event after starring a game');
		it('should only list event after unstarring a game');
		it('should only list event after starring a release');
		it('should only list event after unstarring a release');
		it('should only list event after starring a user');
		it('should only list event after unstarring a user');
		it('should only list event after rating a game');
		it('should only list event after rating a release');
		it('should only list event after uploading a rom');
		it('should only list event after adding a new version to a release');

	});
});