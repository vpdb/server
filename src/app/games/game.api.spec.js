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

"use strict"; /* global describe, before, after, it */

const _ = require('lodash');
const async = require('async');
const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/legacy/superagent-test');
const hlp = require('../../test/legacy/helper');

superagentTest(request);

describe('The VPDB `game` API', function() {

	describe('when posting a new game', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed if provided data is correct', function(done) {

			const user = 'moderator';
			hlp.file.createBackglass(user, request, function(backglass) {
				request
					.post('/api/v1/games')
					.save({ path: 'games/create'})
					.as(user)
					.send(hlp.game.getGame({ _backglass: backglass.id }))
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomGame(user, res.body.id);
						done();
					});
			});
		});

		it('should fail if the ipdb number is already in the database', function(done) {

			let game;
			const user = 'moderator';
			async.series([

				// 1. post game 1
				function(next) {
					hlp.game.createGame(user, request, function(createdGame) {
						game = createdGame;
						next();
					});
				},

				// 2. upload backglass
				function(next) {
					hlp.file.createBackglass(user, request, function(backglass) {
						hlp.doomFile(user, backglass.id);
						game._backglass = backglass.id;
						game.id = game.id + '-2';
						next();
					});
				},

				// 3. re-post game 1
				function(next) {
					request
						.post('/api/v1/games')
						.as(user)
						.send(game)
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('ipdb.number');
							expect(res.body.errors[0].message).to.contain('cannot be added twice');
							next();
						});
				}
			], done);
		});

		it('should fail if the game id is already in the database', function(done) {
			let game;
			const user = 'moderator';
			async.series([

				// 1. post game 1
				function(next) {
					hlp.game.createGame(user, request, function(createdGame) {
						game = createdGame;
						next();
					});
				},

				// 2. upload backglass
				function(next) {
					hlp.file.createBackglass(user, request, function(backglass) {
						hlp.doomFile(user, backglass.id);
						const dupeId = game.id;
						game = hlp.game.getGame({ _backglass: backglass.id });
						game.id = dupeId;
						next();
					});
				},

				// 3. post game 2
				function(next) {
					request
						.post('/api/v1/games')
						.as(user)
						.send(game)
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('id');
							expect(res.body.errors[0].message).to.contain('is already taken');
							next();
						});
				}
			], done);

		});

		it('should fail if a referenced file is already referenced', function(done) {
			let backglassId;
			async.series([

				// 1. upload game
				function(next) {
					hlp.game.createGame('moderator', request, function(game) {
						backglassId = game.backglass.id;
						next();
					});
				},

				// 2. try to re-use backglass in another game
				function(next) {
					request
						.post('/api/v1/games')
						.as('moderator')
						.send(hlp.game.getGame({ _backglass: backglassId }))
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('_backglass');
							expect(res.body.errors[0].message).to.contain('Cannot reference active files');
							next();
						});
				}
			], done);
		});

		it('should fail if the referenced file type for backglass is not backglass.', function(done) {
			let romId;
			async.series([

				// 1. upload game
				next => {
					hlp.file.createRom('moderator', request, rom => {
						romId = rom.id;
						next();
					});
				},

				// 2. try to use rom as backglass
				next => {
					request
						.post('/api/v1/games')
						.as('moderator')
						.send(hlp.game.getGame({ _backglass: romId }))
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('_backglass');
							expect(res.body.errors[0].message).to.contain('file of type "backglass"');
							next();
						});
				}
			], done);
		});
	});

	describe('when updating an existing game', function() {

		let game;
		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
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

		it('should fail for an non-existing game', function(done) {
			request
				.patch('/api/v1/games/brötzl')
				.as('moderator')
				.send({ })
				.end(hlp.status(404, done));
		});

		it('should fail if an invalid field is provided', function(done) {
			request
				.patch('/api/v1/games/' + game.id)
				.as('moderator')
				.send({ created_at: new Date().toString() })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 400, 'invalid field');
					done();
				});
		});

		it('should fail if an invalid value is provided', function(done) {
			request
				.patch('/api/v1/games/' + game.id)
				.as('moderator')
				.send({ game_type: 'zorg' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'game_type', 'invalid game type');
					done();
				});
		});

		it('should succeed with minimal data', function(done) {
			const title = 'Hi, I am your new title.';
			request
				.patch('/api/v1/games/' + game.id)
				.as('moderator')
				.save({ path: 'games/update' })
				.send({ title: title })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.title).to.be(title);

					// refetch to be sure.
					request
						.get('/api/v1/games/' + game.id)
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.title).to.be(title);
							done();
						});
				});
		});
	});

	describe('when listing games', function() {

		const user = 'moderator';
		const count = 10;
		let games = [];

		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ user ]}
			}, function() {
				hlp.game.createGames(user, request, count, function(_games) {
					games = _games;
					done();
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list all games if number of games is smaller or equal to page size', function(done) {
			request
				.get('/api/v1/games')
				.save({ path: 'games/list' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(count);
					done();
				});
		});

		it('should refuse queries with less than two characters', function(done) {
			request.get('/api/v1/games?q=a').saveResponse({ path: 'games/search' }).end(hlp.status(400, 'must contain at least two characters', done));
		});

		it('should fail when providing nonsense number for year filter', function(done) {
			request.get('/api/v1/games?decade=qwez').end(hlp.status(400, '"decade" must be an integer', done));
		});

		it('should find game by game id', function(done) {
			// find added game with shortest id
			const game = _.sortBy(games, function(game) {
				return game.id.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.id)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					let found = false;
					_.each(res.body, function(g) {
						if (g.id === game.id) {
							found = true;
						}
					});
					expect(found).to.be(true);
					done();
				});
		});

		it('should find games by title', function(done) {
			// find added game with longest title
			const game = _.sortBy(games, function(game) {
				return -game.title.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.title.match(/[0-9a-z]{3}/i)[0])
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					let found = false;
					_.each(res.body, function(g) {
						if (g.id === game.id) {
							found = true;
						}
					});
					expect(found).to.be(true);
					done();
				});
		});


		it('should find games by title split by a white space', function(done) {
			// find added game with longest title
			const game = _.sortBy(games, function(game) {
				return -game.title.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.title.match(/[0-9a-z]{2}/i)[0] + '+' + game.title.match(/.*([0-9a-z]{2})/i)[1])
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					let found = false;
					_.each(res.body, function(g) {
						if (g.id === game.id) {
							found = true;
						}
					});
					expect(found).to.be(true);
					done();
				});
		});
	});

	describe('when viewing a game', function() {

		const user = 'moderator';
		let game;

		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ user ]}
			}, function() {
				hlp.game.createGame(user, request, function(_game) {
					game = _game;
					done();
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should return full game details', function(done) {
			request
				.get('/api/v1/games/' + game.id)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('object');
					expect(res.body.title).to.be(game.title);
					expect(res.body.manufacturer).to.be(game.manufacturer);
					expect(res.body.year).to.be(game.year);
					expect(res.body.game_type).to.be(game.game_type);
					expect(res.body.backglass).to.be.an('object');
					expect(res.body.backglass.variations).to.be.an('object');
					expect(res.body.backglass.variations.medium).to.be.an('object');
					done();
				});
		});

		it('that does not exist should return a 404', function(done) {
			request.get('/api/v1/games/01234567890123456789').end(hlp.status(404, done));
		});
	});

	describe('when deleting a game', function() {

		const user = 'moderator';
		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ user ]}
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed if game is not referenced', function(done) {
			hlp.file.createBackglass(user, request, function(backglass) {
				request
					.post('/api/v1/games')
					.as(user)
					.send(hlp.game.getGame({ _backglass: backglass.id }))
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						request
							.del('/api/v1/games/' + res.body.id)
							.save({ path: 'games/delete'})
							.as(user)
							.end(hlp.status(204, done));
					});
			});
		});

		it('should fail if there is a backglass attached to that game', function(done) {
			hlp.game.createGame(user, request, function(game) {
				hlp.file.createDirectB2S(user, request, function(b2s) {
					request
						.post('/api/v1/backglasses')
						.as(user)
						.send({
							_game: game.id,
							authors: [ {
								_user: hlp.users[user].id,
								roles: [ 'creator' ]
							} ],
							versions: [ {
								version: '1.0',
								_file: b2s.id
							} ]
						})
						.end(function(err, res) {
							hlp.doomBackglass(user, res.body.id);
							hlp.expectStatus(err, res, 201);
							request
								.del('/api/v1/games/' + game.id)
								.save({ path: 'games/delete'})
								.as(user)
								.end(hlp.status(400, 'is referenced by', done));
						});
				});
			});
		});

	});

	describe('when requesting a release name', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should return at least two words', function(done) {
			hlp.game.createGame('moderator', request, function(game) {
				request
					.get('/api/v1/games/' + game.id + '/release-name')
					.save({ path: 'games/release-name' })
					.as('member')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.name.split(' ')).to.have.length(3);
						done();
					});
			});
		});

	});
});