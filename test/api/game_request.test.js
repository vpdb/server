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

var fs = require('fs');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `Game Request` API', function() {

	describe('when creating a new game request', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for empty data', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests')
				.as(user)
				.send({})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'ipdb_number', 'must be provided');
					done();
				});
		});

		it('should fail for invalid data', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests')
				.as(user)
				.send({ ipdb_number: 'lolwut' })
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'ipdb_number', 'must be a whole number');
					done();
				});
		});

		it('should fail for an invalid IPDB number', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests')
				.saveResponse({ path: 'game_requests/create'})
				.as(user)
				.send({ ipdb_number: 9981123 })
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'ipdb_number', 'ipdb number does not exist');
					done();
				});
		});

		it('should fail for an already existing IPDB number', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				request
					.post('/api/v1/game_requests')
					.as(user)
					.send({ ipdb_number: game.ipdb.number })
					.end(function(err, res) {
						expect(res.body.errors).to.have.length(1);
						hlp.expectValidationError(err, res, 'ipdb_number', 'already in the database');
						done();
					});
			});
		});

		it('should succeed when providing full data', function(done) {
			const user = 'member';
			const title = 'monster bash';
			const notes = 'no monster bash? are you guys kidding???';
			request
				.post('/api/v1/game_requests')
				.as(user)
				.save({ path: 'game_requests/create'})
				.send({
					ipdb_number: 4441,
					title: title,
					notes: notes
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.title).to.be(title);
					expect(res.body.notes).to.be(notes);
					expect(res.body.ipdb_number).to.be(4441);
					expect(res.body.ipdb_title).to.be('Monster Bash');
					expect(res.body.is_closed).to.be(false);
					done();
				});
		});

	});
});