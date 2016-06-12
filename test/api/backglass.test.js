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
				.as('member')
				.send({ _game: game.id, authors: [ { _user: hlp.users['member'].id, roles: [ 'creator' ]}], versions: [ {} ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0._file', 'must provide a file reference');
					hlp.expectValidationError(err, res, 'versions.0.version', 'must be provided');
					expect(res.body.errors.length).to.be(2);
					done();
				});
		});

		it('should fail validations for invalid version data', function(done) {
			request
				.post('/api/v1/backglasses')
				.as('member')
				.send({
					_game: game.id,
					authors: [ { _user: hlp.users['member'].id, roles: [ 'creator' ]}],
					versions: [ {
						version: '',
						_file: 'do-not-exist'
					} ]
				})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.version', 'must be provided');
					hlp.expectValidationError(err, res, 'versions.0._file', 'no such file');
					expect(res.body.errors.length).to.be(2);
					done();
				});
		});

		it('should should succeed with minimal data', function(done) {
			hlp.file.createDirectB2S('member', request, function(b2s) {
				request
					.post('/api/v1/backglasses')
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
					.end(hlp.status(201, done));
			});
		});

		it('should should succeed with full data', function(done) {
			hlp.file.createDirectB2S('member', request, function(b2s1) {
				hlp.file.createDirectB2S('member', request, function(b2s2) {
					const description = 'Photoshopped the super hires backglass together from four different sources!';
					const acknowledgements = '- Thanks @mom for supporting my late hours\n- Thanks @dad for supporting @mom!';
					const changes1 = 'Initial release';
					const changes2 = '- Backglass is now even more high res!\n- It blinks more.';
					request
						.post('/api/v1/backglasses')
						.save({ path: 'backglasses/create' })
						.as('member')
						.send({
							_game: game.id,
							description: description,
							acknowledgements: acknowledgements,
							authors: [{
								_user: hlp.users['member'].id,
								roles: ['creator']
							}],
							versions: [{
								version: '1.0',
								changes: changes1,
								_file: b2s1.id
							}, {
								version: '1.1',
								changes: changes2,
								_file: b2s2.id
							}]
						})
						.end(function(err, res) {

							hlp.expectStatus(err, res, 201);
							expect(res.body.game).to.be.an('object');
							expect(res.body.description).to.be(description);
							expect(res.body.acknowledgements).to.be(acknowledgements);
							expect(res.body.authors[0].user).to.be.an('object');
							expect(res.body.versions[0].version).to.be('1.0');
							expect(res.body.versions[0].changes).to.be(changes1);
							expect(res.body.versions[0].file.variations).to.be.an('object');
							expect(res.body.versions[1].changes).to.be(changes2);
							done();
						});
				});
			});
		});

		it('should automatically link to correct game if game name exists.', function(done) {
			const gameName = 'matchedgame';
			const user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as('member')
					.send({ id: gameName, _file: file.id })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						hlp.file.createDirectB2S('member', request, gameName, function(b2s) {
							request
								.post('/api/v1/backglasses')
								.as('member')
								.send({
									authors: [ {
										_user: hlp.users['member'].id,
										roles: [ 'creator' ]
									} ],
									versions: [ {
										version: '1.0',
										_file: b2s.id
									} ]
								})
								.end(hlp.status(201, done));
						});
					});
			});

		});
	});
});