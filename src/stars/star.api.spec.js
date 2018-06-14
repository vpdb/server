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

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The VPDB `Star` API', function() {

	describe('when starring a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] },
				contributor: { roles: ['contributor'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when providing the wrong release', function(done) {
			request.post('/api/v1/releases/non_existent/star').send({}).as('member').end(hlp.status(404, done));
		});

		it('should succeed when providing correct data', function(done) {
			hlp.release.createRelease('contributor', request, function(release) {
				request.post('/api/v1/releases/' + release.id + '/star')
					.send({})
					.as('member')
					.save({ path: 'releases/create-star'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						expect(res.body.total_stars).to.be(1);
						expect(res.body.created_at).to.be.ok();

						request.get('/api/v1/releases/' + release.id).end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.counter.stars).to.be(1);
							done();
						});
					});
			});
		});

		it('should fail when trying to star twice', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request.post('/api/v1/releases/' + release.id + '/star').send({}).as('member').end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request.post('/api/v1/releases/' + release.id + '/star')
						.send({})
						.as('member')
						.saveResponse({ path: 'releases/create-star'})
						.end(hlp.status(400, 'already starred', done));
				});
			});
		});

		it('should be able to retrieve starred status', function(done) {
			hlp.release.createRelease('moderator', request, function(release) {
				request.get('/api/v1/releases/' + release.id + '/star')
					.as('member')
					.saveResponse({ path: 'releases/view-star'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 404);
						request.post('/api/v1/releases/' + release.id + '/star').send({}).as('member').end(function(err, res) {
							hlp.expectStatus(err, res, 201);
							request.get('/api/v1/releases/' + release.id + '/star')
								.as('member')
								.save({ path: 'releases/view-star'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 200);
									expect(res.body.created_at).to.be.ok();
									done();
								});
						});
					});
			});
		});

		it('should be able to unstar a release', function(done) {
			hlp.release.createRelease('moderator', request, function(release) {
				// star
				request.post('/api/v1/releases/' + release.id + '/star').send({}).as('member').end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					// check
					request.get('/api/v1/releases/' + release.id + '/star')
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.created_at).to.be.ok();
							// unstar
							request.del('/api/v1/releases/' + release.id + '/star')
								.as('member')
								.save({ path: 'releases/delete-star'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 204);
									// check
									request.get('/api/v1/releases/' + release.id + '/star').as('member').end(hlp.status(404, done));
								});
						});
					});
			});
		});
	});

	describe('when starring a game', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed when providing correct data', function(done) {
			hlp.game.createGame('moderator', request, function(game) {
				request.post('/api/v1/games/' + game.id + '/star')
					.send({})
					.as('member')
					.save({ path: 'games/create-star'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						expect(res.body.total_stars).to.be(1);
						expect(res.body.created_at).to.be.ok();

						request.get('/api/v1/games/' + game.id).end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.counter.stars).to.be(1);
							done();
						});
					});
			});
		});

		it('should be able to retrieve starred status', function(done) {
			hlp.game.createGame('moderator', request, function(game) {
				request.get('/api/v1/games/' + game.id + '/star')
					.as('member')
					.saveResponse({ path: 'games/view-star'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 404);
						request.post('/api/v1/games/' + game.id + '/star').send({}).as('member').end(function(err, res) {
							hlp.expectStatus(err, res, 201);
							request.get('/api/v1/games/' + game.id + '/star')
								.as('member')
								.save({ path: 'games/view-star'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 200);
									expect(res.body.created_at).to.be.ok();
									done();
								});
						});
					});
			});
		});

		it('should be able to unstar a game', function(done) {
			hlp.game.createGame('moderator', request, function(game) {
				// star
				request.post('/api/v1/games/' + game.id + '/star').send({}).as('member').end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					// check
					request.get('/api/v1/games/' + game.id + '/star')
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.created_at).to.be.ok();
							// unstar
							request.del('/api/v1/games/' + game.id + '/star')
								.as('member')
								.save({ path: 'games/delete-star'})
								.end(function(err, res) {
									hlp.expectStatus(err, res, 204);
									// check
									request.get('/api/v1/games/' + game.id + '/star').as('member').end(hlp.status(404, done));
								});
						});
				});
			});
		});
	});

	describe('when starring a user', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				ratedMember1: { roles: ['member'] },
				ratedMember2: { roles: ['member'] },
				ratedMember3: { roles: ['member'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should succeed when providing correct data', function(done) {
			const user = hlp.getUser('ratedMember1');
			request.post('/api/v1/users/' + user.id + '/star')
				.send({})
				.as('member')
				.save({ path: 'users/create-star'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					expect(res.body.total_stars).to.be(1);
					expect(res.body.created_at).to.be.ok();

					request.get('/api/v1/users/' + user.id).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.counter.stars).to.be(1);
						done();
					});
				});
		});

		it('should be able to retrieve starred status', function(done) {
			const user = hlp.getUser('ratedMember2');
			request.get('/api/v1/users/' + user.id + '/star')
				.as('member')
				.saveResponse({ path: 'users/view-star'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 404);
					request.post('/api/v1/users/' + user.id + '/star').send({}).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						request.get('/api/v1/users/' + user.id + '/star')
							.as('member')
							.save({ path: 'users/view-star'})
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.created_at).to.be.ok();
								done();
							});
					});
				});
		});

		it('should be able to unstar a user', function(done) {
			const user = hlp.getUser('ratedMember3');
			// star
			request.post('/api/v1/users/' + user.id + '/star').send({}).as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 201);
				// check
				request.get('/api/v1/users/' + user.id + '/star')
					.as('member')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.created_at).to.be.ok();
						// unstar
						request.del('/api/v1/users/' + user.id + '/star')
							.as('member')
							.save({ path: 'users/delete-star'})
							.end(function(err, res) {
								hlp.expectStatus(err, res, 204);
								// check
								request.get('/api/v1/users/' + user.id + '/star').as('member').end(hlp.status(404, done));
							});
					});
			});
		});
	});

	describe('when unstarring a game', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				moderator: { roles: ['moderator'] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if the game is not starred', function(done) {
			hlp.game.createGame('moderator', request, function(game) {
				// unstar
				request.del('/api/v1/games/' + game.id + '/star')
					.send({})
					.as('member')
					.end(hlp.status(400, 'need to star something', done));
			});
		});

		it('should succeed and updated counter accordingly', function(done) {
			hlp.game.createGame('moderator', request, function(game) {

				// star
				request.post('/api/v1/games/' + game.id + '/star')
					.send({})
					.as('member')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);

						// unstar
						request.del('/api/v1/games/' + game.id + '/star')
							.send({})
							.as('member')
							.end(function(err, res) {
								hlp.expectStatus(err, res, 204);
								request.get('/api/v1/games/' + game.id).end(function(err, res) {
									hlp.expectStatus(err, res, 200);
									expect(res.body.counter.stars).to.be(0);
									done();
								});
							});
					});
			});
		});
	});
});