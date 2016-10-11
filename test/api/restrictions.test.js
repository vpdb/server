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
var faker = require('faker');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB restriction feature', function() {

	describe('when dealing with restriced releases', function() {

		var restrictedGame, legalGame;
		var restrictedRelease, legalRelease;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				owner: { roles: [ 'release-contributor' ] },
			}, function() {
				hlp.game.createGame('moderator', request, { ipdb: { number: 99999, mpu: 9999 } }, function(game) {
					restrictedGame = game;
					hlp.doomGame('moderator', game.id);
					hlp.game.createGame('moderator', request, function(game) {
						legalGame = game;
						hlp.doomGame('moderator', game.id);
						hlp.release.createReleaseForGame('owner', request, restrictedGame, function(release) {
							restrictedRelease = release;
							hlp.doomRelease('owner', release.id);
							hlp.release.createReleaseForGame('owner', request, legalGame, function(release) {
								legalRelease = release;
								hlp.doomRelease('owner', release.id);
								done();
							});
						});
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should only list legal release in game details as anonymous', function(done) {
			request.get('/api/v1/games/' + legalGame.id).end(function(err, res) {
				expect(res.body.releases).to.be.an('array');
				expect(res.body.releases).to.have.length(1);
				expect(res.body.releases[0].id).to.be(legalRelease.id);
				request.get('/api/v1/games/' + restrictedGame.id).end(function(err, res) {
					expect(res.body.releases).to.be.an('array');
					expect(res.body.releases).to.be.empty();
					done();
				});
			});
		});

		it('should only list legal release in game details as member', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('member').end(function(err, res) {
				expect(res.body.releases).to.be.an('array');
				expect(res.body.releases).to.have.length(1);
				expect(res.body.releases[0].id).to.be(legalRelease.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('member').end(function(err, res) {
					expect(res.body.releases).to.be.an('array');
					expect(res.body.releases).to.be.empty();
					done();
				});
			});
		});

		it('should list both releases in game details as moderator', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('moderator').end(function(err, res) {
				expect(res.body.releases).to.be.an('array');
				expect(res.body.releases).to.have.length(1);
				expect(res.body.releases[0].id).to.be(legalRelease.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('moderator').end(function(err, res) {
					expect(res.body.releases).to.be.an('array');
					expect(res.body.releases).to.have.length(1);
					expect(res.body.releases[0].id).to.be(restrictedRelease.id);
					done();
				});
			});
		});

		it('should list both releases in game details as owner', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('owner').end(function(err, res) {
				expect(res.body.releases).to.be.an('array');
				expect(res.body.releases).to.have.length(1);
				expect(res.body.releases[0].id).to.be(legalRelease.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('owner').end(function(err, res) {
					expect(res.body.releases).to.be.an('array');
					expect(res.body.releases).to.have.length(1);
					expect(res.body.releases[0].id).to.be(restrictedRelease.id);
					done();
				});
			});
		});

		it('should only list legal releases as anonymous', function(done) {
			request.get('/api/v1/releases?limit=100').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRelease.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRelease.id })).not.to.be.ok();
				done();
			});
		});

		it('should only list legal releases as member', function(done) {
			request.get('/api/v1/releases?limit=100').as('member').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRelease.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRelease.id })).not.to.be.ok();
				done();
			});
		});

		it('should list both releases releases as moderator', function(done) {
			request.get('/api/v1/releases?limit=100').as('moderator').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRelease.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRelease.id })).to.be.ok();
				done();
			});
		});

		it('should list both releases releases as owner', function(done) {
			request.get('/api/v1/releases?limit=100').as('owner').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRelease.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRelease.id })).to.be.ok();
				done();
			});
		});

		it('should fail posting comments to a restricted release', function(done) {
			var msg = faker.company.catchPhrase();
			request.post('/api/v1/releases/' + restrictedRelease.id + '/comments')
				.as('moderator')
				.send({ message: msg })
				.end(hlp.status(404, 'no such release', done));
		});

		it('should fail retrieving release details of a restricted release as anonymous', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id).end(hlp.status(404, done));
		});

		it('should fail retrieving release details of a restricted release as member', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id).as('member').end(hlp.status(404, done));
		});

		it('should succeed retrieving release details of a restricted release as moderator', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id ).as('moderator').end(hlp.status(200, done));
		});

		it('should succeed retrieving release details of a restricted release as owner', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id).as('owner').end(hlp.status(200, done));
		});

		it('should fail retrieving comments of a restricted release as anonymous', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id + '/comments').end(hlp.status(404, done));
		});

		it('should fail retrieving comments of a restricted release as member', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id + '/comments').as('member').end(hlp.status(404, done));
		});

		it('should succeed retrieving comments of a restricted release as moderator', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id + '/comments').as('moderator').end(hlp.status(200, done));
		});

		it('should succeed retrieving comments of a restricted release as owner', function(done) {
			request.get('/api/v1/releases/' + restrictedRelease.id + '/comments').as('owner').end(hlp.status(200, done));
		});

	});

	describe('when dealing with restriced backglasses', function() {

		var restrictedGame, legalGame;
		var restrictedBackglass, legalBackglass;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				owner: { roles: [ 'backglass-contributor' ] },
			}, function() {
				hlp.game.createGame('moderator', request, { ipdb: { number: 99999, mpu: 9999 } }, function(game) {
					restrictedGame = game;
					hlp.doomGame('moderator', game.id);
					hlp.game.createGame('moderator', request, function(game) {
						legalGame = game;
						hlp.doomGame('moderator', game.id);
						hlp.file.createDirectB2S('owner', request, function(b2s) {
							request.post('/api/v1/backglasses').as('owner').send({
									_game: restrictedGame.id,
									authors: [ { _user: hlp.users['owner'].id, roles: [ 'creator' ] } ],
									versions: [ { version: '1.0', _file: b2s.id } ]
								}).end(function(err, res) {
									hlp.expectStatus(err, res, 201);
									restrictedBackglass = res.body;
									hlp.doomBackglass('owner', restrictedBackglass.id);
									hlp.file.createDirectB2S('owner', request, function(b2s) {
										request.post('/api/v1/backglasses').as('owner').send({
											_game: legalGame.id,
											authors: [ { _user: hlp.users['owner'].id, roles: [ 'creator' ] } ],
											versions: [ { version: '1.0', _file: b2s.id } ]
										}).end(function(err, res) {
											hlp.expectStatus(err, res, 201);
											legalBackglass = res.body;
											hlp.doomBackglass('owner', legalBackglass.id);
											done();
										});
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

		it('should only list legal backglass in game details as anonymous', function(done) {
			request.get('/api/v1/games/' + legalGame.id).end(function(err, res) {
				expect(res.body.backglasses).to.be.an('array');
				expect(res.body.backglasses).to.have.length(1);
				expect(res.body.backglasses[0].id).to.be(legalBackglass.id);
				request.get('/api/v1/games/' + restrictedGame.id).end(function(err, res) {
					expect(res.body.backglasses).to.be.an('array');
					expect(res.body.backglasses).to.be.empty();
					done();
				});
			});
		});

		it('should only list legal backglass in game details as member', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('member').end(function(err, res) {
				expect(res.body.backglasses).to.be.an('array');
				expect(res.body.backglasses).to.have.length(1);
				expect(res.body.backglasses[0].id).to.be(legalBackglass.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('member').end(function(err, res) {
					expect(res.body.backglasses).to.be.an('array');
					expect(res.body.backglasses).to.be.empty();
					done();
				});
			});
		});

		it('should list both backglasses in game details as moderator', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('moderator').end(function(err, res) {
				expect(res.body.backglasses).to.be.an('array');
				expect(res.body.backglasses).to.have.length(1);
				expect(res.body.backglasses[0].id).to.be(legalBackglass.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('moderator').end(function(err, res) {
					expect(res.body.backglasses).to.be.an('array');
					expect(res.body.backglasses).to.have.length(1);
					expect(res.body.backglasses[0].id).to.be(restrictedBackglass.id);
					done();
				});
			});
		});

		it('should list both releases in game details as owner', function(done) {
			request.get('/api/v1/games/' + legalGame.id).as('owner').end(function(err, res) {
				expect(res.body.backglasses).to.be.an('array');
				expect(res.body.backglasses).to.have.length(1);
				expect(res.body.backglasses[0].id).to.be(legalBackglass.id);
				request.get('/api/v1/games/' + restrictedGame.id).as('owner').end(function(err, res) {
					expect(res.body.backglasses).to.be.an('array');
					expect(res.body.backglasses).to.have.length(1);
					expect(res.body.backglasses[0].id).to.be(restrictedBackglass.id);
					done();
				});
			});
		});

		it('should only list legal backglasses as anonymous', function(done) {
			request.get('/api/v1/backglasses?limit=100').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalBackglass.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedBackglass.id })).not.to.be.ok();
				done();
			});
		});

		it('should only list legal backglasses as member', function(done) {
			request.get('/api/v1/backglasses?limit=100').as('member').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalBackglass.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedBackglass.id })).not.to.be.ok();
				done();
			});
		});

		it('should list both backglasses as moderator', function(done) {
			request.get('/api/v1/backglasses?limit=100').as('moderator').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalBackglass.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedBackglass.id })).to.be.ok();
				done();
			});
		});

		it('should list both backglasses as owner', function(done) {
			request.get('/api/v1/backglasses?limit=100').as('owner').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalBackglass.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedBackglass.id })).to.be.ok();
				done();
			});
		});

		it('should fail retrieving backglasses details of a restricted release as anonymous', function(done) {
			request.get('/api/v1/backglasses/' + restrictedBackglass.id).end(hlp.status(404, done));
		});

		it('should fail retrieving backglasses details of a restricted release as member', function(done) {
			request.get('/api/v1/backglasses/' + restrictedBackglass.id).as('member').end(hlp.status(404, done));
		});

		it('should succeed retrieving backglasses details of a restricted release as moderator', function(done) {
			request.get('/api/v1/backglasses/' + restrictedBackglass.id ).as('moderator').end(hlp.status(200, done));
		});

		it('should succeed retrieving backglasses details of a restricted release as owner', function(done) {
			request.get('/api/v1/backglasses/' + restrictedBackglass.id).as('owner').end(hlp.status(200, done));
		});

	});

	describe('when dealing with restriced ROMs', function() {

		var restrictedGame, legalGame;
		var restrictedRom, legalRom;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				owner: { roles: [ 'contributor' ] },
			}, function() {
				hlp.game.createGame('moderator', request, { ipdb: { number: 99999, mpu: 9999 } }, function(game) {
					restrictedGame = game;
					hlp.doomGame('moderator', game.id);
					hlp.game.createGame('moderator', request, function(game) {
						legalGame = game;
						hlp.doomGame('moderator', game.id);
						hlp.file.createRom('owner', request, function(file) {
							request.post('/api/v1/games/' + legalGame.id + '/roms').as('owner').send({
								id: 'legalRom',
								_file: file.id
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 201);
								legalRom = res.body;
								hlp.doomRom('owner', legalRom.id);
								hlp.file.createRom('owner', request, function(file) {
									request.post('/api/v1/games/' + restrictedGame.id + '/roms').as('owner').send({
										id: 'restricedRom',
										_file: file.id
									}).end(function(err, res) {
										hlp.expectStatus(err, res, 201);
										restrictedRom = res.body;
										hlp.doomRom('owner', restrictedRom.id);
										done();
									});
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

		it('should only list legal ROM under game as anonymous', function(done) {
			request.get('/api/v1/games/' + legalGame.id + '/roms').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(1);
				expect(res.body[0].id).to.be(legalRom.id);
				request.get('/api/v1/games/' + restrictedGame.id + '/roms').end(function(err, res) {
					expect(res.body).to.be.an('array');
					expect(res.body).to.be.empty();
					done();
				});
			});
		});

		it('should only list legal ROM under game as member', function(done) {
			request.get('/api/v1/games/' + legalGame.id + '/roms').as('member').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(1);
				expect(res.body[0].id).to.be(legalRom.id);
				request.get('/api/v1/games/' + restrictedGame.id + '/roms').as('member').end(function(err, res) {
					expect(res.body).to.be.an('array');
					expect(res.body).to.be.empty();
					done();
				});
			});
		});

		it('should list both backglasses in game details as moderator', function(done) {
			request.get('/api/v1/games/' + legalGame.id + '/roms').as('moderator').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(1);
				expect(res.body[0].id).to.be(legalRom.id);
				request.get('/api/v1/games/' + restrictedGame.id + '/roms').as('moderator').end(function(err, res) {
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(restrictedRom.id);
					done();
				});
			});
		});

		it('should list both releases in game details as owner', function(done) {
			request.get('/api/v1/games/' + legalGame.id + '/roms').as('owner').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(res.body).to.have.length(1);
				expect(res.body[0].id).to.be(legalRom.id);
				request.get('/api/v1/games/' + restrictedGame.id + '/roms').as('owner').end(function(err, res) {
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(1);
					expect(res.body[0].id).to.be(restrictedRom.id);
					done();
				});
			});
		});

		it('should only list legal ROMs as anonymous', function(done) {
			request.get('/api/v1/roms?limit=100').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRom.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRom.id })).not.to.be.ok();
				done();
			});
		});

		it('should only list legal ROMs as member', function(done) {
			request.get('/api/v1/roms?limit=100').as('member').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRom.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRom.id })).not.to.be.ok();
				done();
			});
		});

		it('should list both ROMs as moderator', function(done) {
			request.get('/api/v1/roms?limit=100').as('moderator').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRom.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRom.id })).to.be.ok();
				done();
			});
		});

		it('should list both ROMs as owner', function(done) {
			request.get('/api/v1/roms?limit=100').as('owner').end(function(err, res) {
				expect(res.body).to.be.an('array');
				expect(_.find(res.body, { id: legalRom.id })).to.be.ok();
				expect(_.find(res.body, { id: restrictedRom.id })).to.be.ok();
				done();
			});
		});

	});

});