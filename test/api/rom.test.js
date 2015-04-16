/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

	describe('when posting a new ROM', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
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

		it('should fail for non-existing games', function(done) {
			request.post('/api/v1/games/nonexistent/roms').as('member').send({}).end(hlp.status(404, done));
		});

		it('should fail validations for empty data', function(done) {
			request
				.post('/api/v1/games/' + game.id + '/roms')
				.as('member')
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
				.as('member')
				.send({
					id: '1',
					_file: 'nonexistent'
				})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'id', 'at least 4 characters');
					hlp.expectValidationError(err, res, '_file', 'No such file');
					hlp.expectNoValidationError(err, res, '_game');
					done();
				});
		});

		it('should fail validations for referenced non-rom files', function(done) {
			var user = 'member';
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
			var user = 'member';
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
							hlp.expectValidationError(err, res, '_file', 'must be a zip archive');
							done();
						});
				});
		});

		it('should fail validations for referenced zip-files that are not zip files');

		it('should succeed with minimal data', function(done) {
			var user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as('member')
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
			var user = 'member';
			var version = '1.0';
			var notes = 'That is some ROM.';
			var language = 'en-US';

			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as('member')
					.save({ path: 'games/create-rom' })
					.send({
						id: id,
						version: version,
						notes: notes,
						language: language,
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
						expect(res.body.language).to.be(language);
						done();
					});
			});
		});

		it('should be downloadable by any other user after success', function(done) {
			var user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as('member')
					.send({
						id: 'hulk3',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						var rom = res.body;
						hlp.storageToken(request, 'member2', rom.file.url, function(token) {
							request.get(rom.file.url).query({ token: token }).as('member2').end(hlp.status(200, done));
						});
					});
			});
		});

		it('should be listed under the game after success', function(done) {
			var user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as(user)
					.send({
						id: 'hulk4',
						_file: file.id
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomRom(user, res.body.id);
						request.get('/api/v1/games/' + game.id + '/roms').end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.be.an('array');
							expect(res.body.length).to.be.above(0);
							expect(res.body[0].file).to.be.an('object');
							expect(res.body[0].created_by).to.be.an('object');
							done();
						});
					});
			});
		});

		it('should fail if rom with same ID already exists', function(done) {
			var user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request
					.post('/api/v1/games/' + game.id + '/roms')
					.as('member')
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
								.as('member')
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

	describe('when deleting a ROM', function() {

		var game;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
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

		it('should succeed as member and owner', function(done) {
			var user = 'member';
			hlp.file.createRom(user, request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as(user).send({ id: 'hulk', _file: file.id }).end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).save('roms/del').as(user).end(hlp.status(204, done));
				});
			});
		});

		it('should fail as member and not owner', function(done) {
			var user = 'member';
			var id = 'hulkdeleteme';
			hlp.file.createRom(user, request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as(user).send({ id: id, _file: file.id }).end(function(err, res) {
					hlp.doomRom(user, id);
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).as('member2').end(hlp.status(403, done));
				});
			});
		});

		it('should succeed as contributor and not owner', function(done) {
			var user = 'member';
			var id = 'hulk';
			hlp.file.createRom(user, request, function(file) {
				request.post('/api/v1/games/' + game.id + '/roms').as(user).send({ id: id, _file: file.id }).end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/roms/' + res.body.id).as('contributor').end(hlp.status(204, done));
				});
			});

		});

	});

});