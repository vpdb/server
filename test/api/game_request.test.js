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
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.saveResponse({ path: 'game_requests/create'})
				.as(user)
				.send({ ipdb_number: 9981123 })
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(1);
					hlp.expectValidationError(err, res, 'ipdb_number', 'does not exist');
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

		it('should fail if an open request already exists', function(done) {
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

		it('should succeed when providing minimal data', function(done) {
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 4441 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					expect(res.body.ipdb_number).to.be(4441);
					expect(res.body.ipdb_title).to.be('Monster Bash');
					expect(res.body.is_closed).to.be(false);
					done();
				});
		});

		it('should succeed when providing full data', function(done) {
			const user = 'member';
			const title = 'monster bash';
			const notes = 'no monster bash? are you guys kidding???';
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as(user)
				.save({ path: 'game_requests/create'})
				.send({
					ipdb_number: 2768,
					title: title,
					notes: notes
				})
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					expect(res.body.title).to.be(title);
					expect(res.body.notes).to.be(notes);
					expect(res.body.ipdb_number).to.be(2768);
					expect(res.body.ipdb_title).to.be('White Water');
					expect(res.body.is_closed).to.be(false);
					done();
				});
		});

		it('should fail for an already existing game request', function(done) {
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 1001 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					request
						.post('/api/v1/game_requests?ipdb_dryrun=1')
						.as('member')
						.send({ ipdb_number: 1001 })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'ipdb_number', 'already been requested');
							done();
						});
				});
		});

	});

	describe('when updating an existing game request', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for invalid fields', function(done) {
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 2006 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					request
						.patch('/api/v1/game_requests/' + res.body.id)
						.as('moderator')
						.send({ title: 'new title' })
						.end(hlp.status(400, 'invalid field', done));
				});
		});

		it('should fail if closed without message', function(done) {
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 2007 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					request
						.patch('/api/v1/game_requests/' + res.body.id)
						.as('moderator')
						.send({ is_closed: true })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'message', 'must be set');
							done();
						});
				});
		});

		it('should succeed when closing a game request', function(done) {

			// create
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 2008 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					let gameRequestId = res.body.id;

					// verify that request is open
					request
						.get('/api/v1/game_requests?status=open')
						.as('moderator')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							let gameRequest = _.find(res.body, r => r.id === gameRequestId);
							expect(gameRequest.is_closed).to.be(false);

							const message = 'Game is already added with IPDB number xxx. We do not keep multiple editions of the same game.';

							// close request
							request
								.patch('/api/v1/game_requests/' + gameRequestId)
								.as('moderator')
								.save('game_requests/update')
								.send({ is_closed: true, message: message })
								.end(function(err, res) {
									hlp.expectStatus(err, res, 200);

									// verify that request is open
									request
										.get('/api/v1/game_requests?status=denied')
										.as('moderator')
										.end(function(err, res) {
											hlp.expectStatus(err, res, 200);
											let gameRequest = _.find(res.body, r => r.id === gameRequestId);
											expect(gameRequest.is_closed).to.be(true);
											expect(gameRequest.message).to.be(message);
											done();
										});
								});
						});
				});
		});
	});

	describe('when adding a game for a game request', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should close the game request when a game with the same IPDB number is created', function(done) {
			const user = 'moderator';

			// create request
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 1267 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					let gameRequestId = res.body.id;

					// create game with same ipdb number
					hlp.file.createBackglass(user, request, function(backglass) {
						request
							.post('/api/v1/games')
							.as(user)
							.send(hlp.game.getGame({ _backglass: backglass.id }, 1267))
							.end(function(err, res) {
								let game = res.body;
								hlp.expectStatus(err, res, 201);
								hlp.doomGame(user, res.body.id);

								// verify previous request is closed
								request
									.get('/api/v1/game_requests?status=closed')
									.as('moderator')
									.end(function(err, res) {
										hlp.expectStatus(err, res, 200);
										let gameRequest = _.find(res.body, r => r.id === gameRequestId);
										expect(gameRequest.is_closed).to.be(true);
										expect(gameRequest.game.id).to.be(game.id);
										done();
									});
							});
					});
				});
		});

		it('should close the game request when a game containing the game request reference is created', function(done) {
			const user = 'moderator';

			// create request
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 20 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					let gameRequestId = res.body.id;

					// create game with _game_request set
					hlp.file.createBackglass(user, request, function(backglass) {
						request
							.post('/api/v1/games')
							.as(user)
							.send(hlp.game.getGame({ _backglass: backglass.id, _game_request: gameRequestId }))
							.end(function(err, res) {
								let game = res.body;
								hlp.expectStatus(err, res, 201);
								hlp.doomGame(user, res.body.id);

								// verify previous request is closed
								request
									.get('/api/v1/game_requests?status=closed')
									.as('moderator')
									.end(function(err, res) {
										hlp.expectStatus(err, res, 200);
										let gameRequest = _.find(res.body, r => r.id === gameRequestId);
										expect(gameRequest.is_closed).to.be(true);
										expect(gameRequest.game.id).to.be(game.id);
										done();
									});
							});
					});
				});
		});

		it('should not close the game request when a game containing neither game request reference nor same ipdb number is created', function(done) {
			const user = 'moderator';

			// create request
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as('member')
				.send({ ipdb_number: 51 })
				.end(function(err, res) {
					hlp.doomGameRequest('member', res.body.id);
					hlp.expectStatus(err, res, 201);
					let gameRequestId = res.body.id;

					// create game with no references to game request
					hlp.file.createBackglass(user, request, function(backglass) {
						request
							.post('/api/v1/games')
							.as(user)
							.send(hlp.game.getGame({ _backglass: backglass.id }, 510))
							.end(function(err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomGame(user, res.body.id);

								// verify previous request is closed
								request
									.get('/api/v1/game_requests?status=all')
									.as('moderator')
									.end(function(err, res) {
										hlp.expectStatus(err, res, 200);
										let gameRequest = _.find(res.body, r => r.id === gameRequestId);
										expect(gameRequest.is_closed).to.be(false);
										done();
									});
							});
					});
				});

		});

	});

	describe('when deleting a game request', function() {

		var game;
		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if the game request does not exist', function(done) {
			request.del('/api/v1/game_requests/1234').as('moderator').end(hlp.status(404, 'no such game request', done));
		});

		it('should fail if the game request is owned by another member', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as(user)
				.send({ ipdb_number: 1234 })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomGameRequest(user, res.body.id);
					request.del('/api/v1/game_requests/' + res.body.id).as('member2').saveResponse('game_requests/del').end(hlp.status(403, 'must be owner', done));
				});
		});

		it('should fail if the game request is owned by another contributor', function(done) {
			const user = 'member';
				request
					.post('/api/v1/game_requests?ipdb_dryrun=1')
					.as(user)
					.send({ ipdb_number: 1235 })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomGameRequest(user, res.body.id);
						request.del('/api/v1/game_requests/' + res.body.id).as('contributor').end(hlp.status(403, 'must be owner', done));
					});
		});

		it('should succeed if the game request is owned', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as(user)
				.send({ ipdb_number: 1236 })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/game_requests/' + res.body.id).as(user).save('game_requests/del').end(hlp.status(204, done));
				});
		});

		it('should succeed as moderator', function(done) {
			const user = 'member';
			request
				.post('/api/v1/game_requests?ipdb_dryrun=1')
				.as(user)
				.send({ ipdb_number: 1237 })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.del('/api/v1/game_requests/' + res.body.id).as('moderator').end(hlp.status(204, done));
				});
		});

	});
});