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

describe('The VPDB `Backglass` API', function() {

	describe('when posting a new backglass', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.game.createGame('contributor', request, function(g) {
					game = g;
					done(null, g);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail validations for empty data', function(done) {
			request
				.post('/api/v1/backglasses')
				.saveResponse({ path: 'backglasses/create'})
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_game', 'is required');
					hlp.expectValidationError(err, res, 'authors', 'at least one author');
					hlp.expectValidationError(err, res, 'versions', 'at least one version');
					expect(res.body.errors.length).to.be(3);
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/backglasses')
				.saveResponse({ path: 'backglasses/create'})
				.as('member')
				.send({ _game: 'non existant', authors: [{ _user: 'grützl', roles: [] }], versions: [] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_game', 'no such game');
					hlp.expectValidationError(err, res, 'authors.0._user', 'no such user');
					hlp.expectValidationError(err, res, 'versions', 'at least one version');
					expect(res.body.errors.length).to.be(3);
					done();
				});
		});

		it('should fail validations for empty version data', function(done) {
			request
				.post('/api/v1/backglasses')
				.saveResponse({ path: 'backglasses/create'})
				.as('member')
				.send({ _game: game.id, authors: [ { _user: hlp.users['member'].id, roles: [ 'creator' ]}], versions: [ {} ] })
				.end(function(err, res) {
					hlp.dump(res);
					hlp.expectValidationError(err, res, 'versions.0._file', 'must provide a file reference');
					hlp.expectValidationError(err, res, 'versions.0.version', 'must be provided');
					expect(res.body.errors.length).to.be(2);
					done();
				});
		});

		it.skip('should fail validations for invalid version data', function(done) {
			request
				.post('/api/v1/backglasses')
				.saveResponse({ path: 'backglasses/create'})
				.as('member')
				.send({ _game: game.id, authors: [ { _user: hlp.users['member'].id, roles: [ 'creator' ]}], versions: [ {
					version: 1,
					changes: 2,
					_file: 'do-not-exist',
					released_at: 'lol-no-date!'
				} ] })
				.end(function(err, res) {
					hlp.dump(res);
					hlp.expectValidationError(err, res, 'versions.0.version', 'no such file');
					hlp.expectValidationError(err, res, 'versions.0.changes', 'no such file');
					hlp.expectValidationError(err, res, 'versions.0._file', 'no such file');
					hlp.expectValidationError(err, res, 'versions.0.released_at', 'no such file');
					expect(res.body.errors.length).to.be(4);
					done();
				});
		});

		it.only('should should succeed with minimal data', function(done) {
			hlp.file.createDirectB2S('member', request, function(b2s) {
				request
					.post('/api/v1/backglasses')
					.saveResponse({ path: 'backglasses/create'})
					.as('member')
					.send({
						_game: game.id,
						authors: [ {
							_user: hlp.users['member'].id,
							roles: [ 'creator' ]
						} ],
						versions: [ {
							version: '1.0',
							_file: b2s.id
						} ]
					})
					.end(function(err, res) {

						hlp.dump(res);
						hlp.expectStatus(err, res, 201);
						done();
					});
			});
		});
	});
});