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
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB moderation feature', function() {

	describe('when accepting a moderated ROM', function() {

		var game, rom;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, function() {
				hlp.game.createGame('moderator', request, function(g) {
					game = g;
					hlp.file.createRom('member', request, function(file) {
						request
							.post('/api/v1/games/' + game.id + '/roms')
							.as('member')
							.send({
								id: 'hulk',
								_file: file.id
							})
							.end(function(err, res) {
								rom = res.body;
								hlp.expectStatus(err, res, 201);
								hlp.doomRom('member', res.body.id);
								done();
							});
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for empty data', function(done) {
			const user = 'moderator';
			request
				.post('/api/v1/roms/' + rom.id + '/moderate')
				.as(user)
				.send({})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'action', 'must be provided');
					done();
				});
		});

		it('should fail for invalid action', function(done) {
			const user = 'moderator';
			request
				.post('/api/v1/roms/' + rom.id + '/moderate')
				.as(user)
				.send({ action: 'brümütz!!'})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'action', 'invalid action');
					done();
				});
		});

		it('should fail when message is missing for refusal', function(done) {
			const user = 'moderator';
			request
				.post('/api/v1/roms/' + rom.id + '/moderate')
				.as(user)
				.send({ action: 'refuse' })
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'message', 'message must be provided');
					done();
				});
		});

	});
});