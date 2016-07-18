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

			var user = 'moderator';
			hlp.file.createBackglass(user, request, function(backglass) {
				request
					.post('/api/v1/games')
					.save({ path: 'games/create'})
					.as(user)
					.send(hlp.game.getGame({ _media: { backglass: backglass.id }}))
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomGame(user, res.body.id);
						done();
					});
			});
		});

		it('should fail if the ipdb number is already in the database', function(done) {

			var game;
			var user = 'moderator';
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
						delete game.media;
						game._media = { backglass: backglass.id };
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
			var game;
			var user = 'moderator';
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
						var dupeId = game.id;
						game = hlp.game.getGame({ _media: { backglass: backglass.id }});
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

		it('should fail if a referenced file is not of the same owner', function(done) {
			var backglassId;
			async.series([

				// 1. upload backglass as "member"
				function(next) {
					hlp.file.createBackglass('member', request, function(backglass) {
						hlp.doomFile('member', backglass.id);
						backglassId = backglass.id;
						next();
					});
				},

				// 2. post game as "moderator"
				function(next) {
					request
						.post('/api/v1/games')
						.as('moderator')
						.send(hlp.game.getGame({ _media: { backglass: backglassId }}))
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('_media.backglass');
							expect(res.body.errors[0].message).to.contain('must be of the same owner');
							next();
						});
				}
			], done);
		});

		it('should fail if a referenced file is already referenced', function(done) {
			var backglassId;
			async.series([

				// 1. upload game
				function(next) {
					hlp.game.createGame('moderator', request, function(game) {
						backglassId = game.media.backglass.id;
						next();
					});
				},

				// 2. try to re-use backglass in another game
				function(next) {
					request
						.post('/api/v1/games')
						.as('moderator')
						.send(hlp.game.getGame({ _media: { backglass: backglassId }}))
						.end(function(err, res) {
							hlp.expectStatus(err, res, 422);
							expect(res.body.errors).to.have.length(1);
							expect(res.body.errors[0].field).to.be('_media.backglass');
							expect(res.body.errors[0].message).to.contain('Cannot reference active files');
							next();
						});
				}
			], done);
		});

		it('should fail if the referenced file type for backglass is not backglass.');
	});

	describe('when updating an existing game', function() {

		var game;
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

		var user = 'moderator';
		var count = 10;
		var games = [];

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

		it('should find game by game id', function(done) {
			// find added game with shortest id
			var game = _.sortBy(games, function(game) {
				return game.id.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.id)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					var found = false;
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
			var game = _.sortBy(games, function(game) {
				return -game.title.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.title.match(/[0-9a-z]{3}/i)[0])
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					var found = false;
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
			var game = _.sortBy(games, function(game) {
				return -game.title.length;
			})[0];

			request
				.get('/api/v1/games?q=' + game.title.match(/[0-9a-z]{2}/i)[0] + '+' + game.title.match(/.*([0-9a-z]{2})/i)[1])
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body.length).to.be.above(0);
					var found = false;
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

	describe('when retrieving a game', function() {

		var user = 'moderator';
		var game;

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
					expect(res.body.media).to.be.an('object');
					expect(res.body.media.backglass).to.be.an('object');
					expect(res.body.media.backglass.variations).to.be.an('object');
					done();
				});
		});

		it('that does not exist should return a 404', function(done) {
			request.get('/api/v1/games/01234567890123456789').end(hlp.status(404, done));
		});
	});

	describe('when deleting a game', function() {

		var user = 'moderator';
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
					.send(hlp.game.getGame({ _media: { backglass: backglass.id }}))
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
});