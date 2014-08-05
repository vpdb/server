"use strict"; /*global describe, before, after, it*/

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
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed if provided data is correct', function(done) {

			var user = 'contributor';
			hlp.file.createBackglass(user, request, function(backglass) {
				request
					.post('/api/games')
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
			var user = 'contributor';
			async.series([

				// 1. post game 1
				function(next) {
					hlp.game.createGame(user, request, function(createdGame) {
						game = createdGame;
						hlp.doomGame(user, game.id);
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
						.post('/api/games')
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
			var user = 'contributor';
			async.series([

				// 1. post game 1
				function(next) {
					hlp.game.createGame(user, request, function(createdGame) {
						game = createdGame;
						hlp.doomGame(user, game.id);
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
						.post('/api/games')
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

				// 2. post game as "contributor"
				function(next) {
					request
						.post('/api/games')
						.as('contributor')
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
					hlp.game.createGame('contributor', request, function(game) {
						hlp.doomGame('contributor', game.id);
						backglassId = game.media.backglass.id;
						next();
					});
				},

				// 2. try to re-use backglass in another game
				function(next) {
					request
						.post('/api/games')
						.as('contributor')
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

	});

	describe('when listing games', function() {

		var user = 'contributor';
		var count = 10;
		var games = [];

		before(function(done) {
			hlp.setupUsers(request, {
				contributor: { roles: [ user ]}
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
				.get('/api/games')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(count);
					done();
				});
		});
	});

	describe('when deleting a game', function() {

		it('should succeed if game is not referenced');

	});
});