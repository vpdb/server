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

describe('The VPDB `ROM` API', function() {

	describe('when posting a new ROM for a given game', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.game.createGame('moderator', request, function(g) {
					game = g;
					done(null, g);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for non-existing games', function(done) {
			request.post('/api/v1/games/nonexistent/roms').as('moderator').send({}).end(hlp.status(404, done));
		});

		it('should fail when posting with an IPDB number', function(done) {
			request
				.post('/api/v1/games/' + game.id + '/roms')
				.as('moderator')
				.send({ _ipdb_number: 1234 })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_ipdb_number', 'You must not provide an IPDB number');
					done();
				});
		});

		it('should fail validations for empty data', function(done) {
			request
				.post('/api/v1/games/' + game.id + '/roms')
				.as('moderator')
				.saveResponse({ path: 'games/create-rom' })
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'id', 'must be provided');
					hlp.expectValidationError(err, res, '_file', 'must be provided');
					done();
				});
		});

		it('should fail validations for invalid data', function(done) {
			request
				.post('/api/v1/games/' + game.id + '/roms')
				.as('moderator')
				.send({
					id: '1',
					_file: 'nonexistent'
				})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'id', 'at least 2 characters');
					hlp.expectValidationError(err, res, '_file', 'No such file');
					hlp.expectNoValidationError(err, res, '_game');
					done();
				});
		});

		it('should fail validations for referenced non-rom files', function(done) {
			var user = 'moderator';
			hlp.file.createZip(user, request, function(file) {
				hlp.doomFile(user, file.id);
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'test',
						version: '1.0',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectValidationError(err, res, '_file', 'must be a file of type "rom"');
						done();
					});
			});
		});

		it('should fail validations for referenced non-zip files', function(done) {
			var user = 'moderator';
			request
				.post('/storage/v1/files')
				.query({ type: 'release' })
				.type('text/plain')
				.set('Content-Disposition', 'attachment; filename="README.txt"')
				.send('You are looking at a text file generated during a test.')
				.as(user)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile(user, res.body.id);
					request
						.post('/api/v1/games/' + game.id + '/roms')
						.as(user)
						.send({
							id: 'test',
							version: '1.0',
							_file: res.body.id
						})
						.end(function(err, res) {
							hlp.expectValidationError(err, res, '_file', 'must be a file of type "rom"');
							done();
						});
				});
		});

		it('should succeed with minimal data', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'hulk',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						expect(res.body.id).to.be('hulk');
						expect(res.body.file).to.be.an('object');
						expect(res.body.file.url).to.be.ok();
						done();
					});
			});
		});

		it('should succeed with full data', function(done) {
			var id = game.id + '_10';
			var user = 'moderator';
			var version = '1.0';
			var notes = 'That is some ROM.';
			var language = 'en-US';

			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.save({ path: 'games/create-rom' })
					.send({
						id: id,
						version: version,
						notes: notes,
						languages: [ language ],
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						expect(res.body.id).to.be(id);
						expect(res.body.file).to.be.an('object');
						expect(res.body.file.url).to.be.ok();
						expect(res.body.version).to.be(version);
						expect(res.body.notes).to.be(notes);
						expect(res.body.languages).to.be.an('array');
						expect(res.body.languages[0]).to.be(language);
						done();
					});
			});
		});

		it('should be downloadable by any other user after success', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'hulk3',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						var rom = res.body;
						hlp.storageToken(request, 'member', rom.file.url, function(token) {
							request.get(hlp.urlPath(rom.file.url)).query({ token: token }).as('member').end(hlp.status(200, done));
						});
					});
			});
		});

		it('should be listed under the game after success as contributor', function(done) {
			var user = 'contributor';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'hulk5',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						request.get('/api/v1/games/' + game.id + '/roms').end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.be.an('array');
							let rom = _.find(res.body, { id: 'hulk5' });
							expect(rom).to.be.an('object');
							expect(rom.created_by).to.be.an('object');
							done();
						});
					});
			});
		});

		it('should fail if ROM with same ID already exists', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'hulk-dupe',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);

						hlp.file.createRom(user, request, function(file) {
							hlp.doomFile(user, file.id);
							request
								.post('/api/v1/games/' + game.id + '/roms')
								.as(user)
								.send({
									id: 'hulk-dupe',
									_file: file.id
								})
								.end(function(err, res) {
									hlp.expectValidationError(err, res, 'id', '"hulk-dupe" is already taken');
									done();
								});
						});
					});
			});
		});
	});

	describe('when posting a new ROM for a given IPDB number', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.game.createGame('moderator', request, function(g) {
					game = g;
					done(null, g);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when posting without IPDB number', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				hlp.doomFile(user, file.id);
				request
					.post('/api/v1/roms')
					.as(user)
					.send({
						id: 'tz_pa1',
						_file: file.id
					})
					.end(hlp.status(400, 'must provide an ipdb number', done));
			});
		});

		it('should fail when posting with IPDB number that is not a number', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				hlp.doomFile(user, file.id);
				request
					.post('/api/v1/roms')
					.as(user)
					.send({
						id: 'tz_pa1',
						_file: file.id,
						_ipdb_number: 'foobar'
					})
					.end(function(err, res) {
						hlp.expectValidationError(err, res, '_ipdb_number', 'must be a positive integer');
						done();
					});
			});
		});

		it('should succeed when providing minimal data', function(done) {
			var user = 'moderator';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/roms')
					.as(user)
					.save('roms/create')
					.send({
						id: 'tz_pa1',
						_file: file.id,
						_ipdb_number: 2684
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						expect(res.body.id).to.be('tz_pa1');
						expect(res.body.file).to.be.an('object');
						expect(res.body.file.url).to.be.ok();
						done();
					});
			});
		});

		it('should link the game to the ROM when creating game after ROM', function(done) {
			var user = 'contributor';
			var ipdbNumber = 99991;
			// create rom file
			hlp.file.createRom(user, request, function(file) {

				// link to ipdb number
				request
					.post('/api/v1/roms')
					.as(user)
					.send({
						id: 'tz_pa2',
						_file: file.id,
						_ipdb_number: ipdbNumber
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);

						// create game
						hlp.file.createBackglass(user, request, function(backglass) {
							request
								.post('/api/v1/games')
								.as(user)
								.send(hlp.game.getGame({ _backglass: backglass.id, ipdb: { number: ipdbNumber }}))
								.end(function(err, res) {
									hlp.expectStatus(err, res, 201);
									hlp.doomGame('moderator', res.body.id);

									// list roms
									request
										.get('/api/v1/games/' + res.body.id + '/roms')
										.end(function(err, res) {
											hlp.expectStatus(err, res, 200);

											expect(res.body).to.be.an('array');
											expect(res.body).to.have.length(1);
											done();
										});
								});
						});
					});
			});
		});

		it('should link the ROM to the game when creating ROM with IPDB number for existing game', function(done) {
			// create rom file
			hlp.file.createRom('contributor', request, function(file) {

				// link to ipdb number of existing game
				request
					.post('/api/v1/roms')
					.as('contributor')
					.send({
						id: 'tz_pa3',
						_file: file.id,
						_ipdb_number: game.ipdb.number
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom('moderator', res.body.id);

						// list roms
						request
							.get('/api/v1/games/' + game.id + '/roms')
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);

								expect(res.body).to.be.an('array');
								expect(res.body).to.have.length(1);
								done();
							});
					});
			});
		});

	});

	describe('when deleting a ROM', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				contributor: { roles: [ 'contributor' ] },
				moderator: { roles: [ 'moderator' ] }
			}, function() {
				hlp.game.createGame('moderator', request, function(g) {
					game = g;
					done(null, g);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed as contributor and owner', function(done) {
			var user = 'contributor';
			hlp.file.createRom(user, request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as(user).send({ id: 'hulk', _file: file.id }).end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).save('roms/del').as(user).end(hlp.status(204, done));
				});
			});
		});

		it('should fail as contributor and not owner', function(done) {
			var id = 'hulkdeleteme';
			hlp.file.createRom('moderator', request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as('moderator').send({ id: id, _file: file.id }).end(function(err, res) {
					hlp.doomRom('moderator', id);
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).as('contributor').end(hlp.status(403, done));
				});
			});
		});

		it('should succeed as moderator and not owner', function(done) {
			var id = 'hulk';
			hlp.file.createRom('contributor', request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as('contributor').send({ id: id, _file: file.id }).end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).as('moderator').end(hlp.status(204, done));
				});
			});
		});

	});

	describe('when listing ROMs', function() {

		var game;
		var ipdbNumber = 888;
		var romId1 = 'hulk';
		var romId2 = 'tz_pa1';

		before(function(done) {
			var user = 'moderator';
			hlp.setupUsers(request, {
				contributor: { roles: ['contributor'] },
				moderator: { roles: ['moderator'] }
			}, function() {
				hlp.game.createGame('moderator', request, function(g) {
					game = g;
					hlp.file.createRom(user, request, function(file) {
						request
							.post('/api/v1/games/' + game.id + '/roms')
							.as(user)
							.send({ id: romId1, _file: file.id })
							.end(function(err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRom(user, romId1);
								hlp.file.createRom(user, request, function(file) {
									request
										.post('/api/v1/roms')
										.as(user)
										.send({
											id: romId2,
											_file: file.id,
											_ipdb_number: ipdbNumber
										})
										.end(function(err, res) {
											hlp.expectStatus(err, res, 201);
											hlp.doomRom(user, romId2);
											done();
										});
								});
							});
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list all ROMs', function(done) {
			request
				.get('/api/v1/roms')
				.save({ path: 'roms/list' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(2);
					done();
				});
		});

		it('should list ROMs under the game resource', function(done) {
			request
				.get('/api/v1/games/' + game.id + '/roms')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(romId1);
					done();
				});
		});

		it('should list ROMs when searching by game ID', function(done) {
			request
				.get('/api/v1/roms?game_id=' + game.id)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(romId1);
					done();
				});
		});

		it('should list ROMs when searching by IPDB number', function(done) {
			request
				.get('/api/v1/roms?ipdb_number=' + game.ipdb.number)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(romId1);
					done();
				});
		});

		it('should list ROMs when searching by IPDB number for games without reference', function(done) {
			request
				.get('/api/v1/roms?ipdb_number=' + ipdbNumber)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(romId2);
					done();
				});
		});
	});

});