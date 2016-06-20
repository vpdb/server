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

describe('The VPDB `Media` API', function() {

	describe('when posting media', function() {

		var backglass;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: ['member'] },
				contributor: { roles: ['contributor'] }
			}, function() {
				hlp.file.createBackglass('member', request, function(bg) {
					hlp.doomFile('member', bg.id);
					backglass = bg;
					done();
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail for empty data', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(2);
					hlp.expectValidationError(err, res, '_file', 'must provide a file reference');
					hlp.expectValidationError(err, res, 'category', 'must provide a category');
					done();
				});
		});

		it('should fail when providing invalid data', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'flütz', _file: 'brögl', _ref: { game: 'bitzü' }})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(3);
					hlp.expectValidationError(err, res, '_file', 'no such file');
					hlp.expectValidationError(err, res, '_ref.game', 'no such game');
					hlp.expectValidationError(err, res, 'category', 'invalid category');
					done();
				});
		});

		it('should fail when providing incomplete category (no child)', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.saveResponse({ path: 'media/create' })
				.send({ category: 'flyer_image' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'category', 'must provide sub-category');
					done();
				});
		});

		it('should fail when providing an incomplete category (no variation)', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'playfield_image' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'category', 'must provide sub-category');
					done();
				});
		});

		it('should fail when providing an incomplete category (no variation)', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'playfield_image' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'category', 'must provide sub-category');
					done();
				});
		});

		it('should fail when providing an invalid sub-category (variation)', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'playfield_image/grützl' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'category', 'invalid sub-category');
					done();
				});
		});

		it('should fail when providing an invalid sub-category (child)', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'flyer_image/grützl' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'category', 'invalid sub-category');
					done();
				});
		});

		it('should fail when no reference for a valid category is provided', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'backglass_image' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_ref', 'reference to game missing');
					done();
				});
		});

		it('should fail when the referenced file has an invalid mime type', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'backglass_video', _file: backglass.id })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_file', 'invalid mime type');
					done();
				});
		});

		it('should fail when the referenced file has an invalid file type', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'wheel_image', _file: backglass.id })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_file', 'invalid file type');
					done();
				});
		});

		it('should fail when the referenced file has an invalid file type of a variation', function(done) {
			const user = 'member';
			request
				.post('/api/v1/media')
				.as(user)
				.send({ category: 'playfield_image/fs', _file: backglass.id })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_file', 'invalid file type');
					done();
				});
		});

		it('should succeed for minimal data', function(done) {
			const user = 'member';
			hlp.file.createBackglass(user, request, function(bg) {
				hlp.game.createGame('contributor', request, function(game) {
					request
						.post('/api/v1/media')
						.as(user)
						.send({
							category: 'backglass_image',
							_file: bg.id,
							_ref: { game: game.id }
						})
						.end(function(err, res) {
							hlp.doomMedium(user, res.body.id);
							hlp.expectStatus(err, res, 201);
							expect(res.body.game).to.be.an('object');
							expect(res.body.category).to.be('backglass_image');
							expect(res.body.created_by).to.be.an('object');
							done();
						});
				});
			});
		});

		it('should succeed for full data', function(done) {
			const user = 'member';
			const description = 'This is a very super high resolution backglass that I have stitched together from four different sources.';
			const acknowledgements = '- Thanks to @mom for all her patience';
			hlp.file.createBackglass(user, request, function(bg) {
				hlp.game.createGame('contributor', request, function(game) {
					request
						.post('/api/v1/media')
						.as(user)
						.save({ path: 'media/create' })
						.send({
							description: description,
							acknowledgements: acknowledgements,
							category: 'backglass_image',
							_file: bg.id,
							_ref: { game: game.id }
						})
						.end(function(err, res) {
							hlp.doomMedium(user, res.body.id);
							hlp.expectStatus(err, res, 201);
							expect(res.body.game).to.be.an('object');
							expect(res.body.description).to.be(description);
							expect(res.body.acknowledgements).to.be(acknowledgements);
							expect(res.body.category).to.be('backglass_image');
							expect(res.body.created_by).to.be.an('object');
							done();
						});
				});
			});
		});
	});

	describe('when deleting a medium', function() {

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

		it('should fail if the medium does not exist', function(done) {
			request.del('/api/v1/media/1234').as('contributor').end(hlp.status(404, 'no such medium', done));
		});

		it('should fail if the medium is owned by someone else', function(done) {
			const user = 'member';
			hlp.file.createBackglass(user, request, function(bg) {
				request
					.post('/api/v1/media')
					.as(user)
					.send({
						_ref: { game: game.id },
						_file: bg.id,
						category: 'backglass_image'
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomMedium(user, res.body.id);
						request.del('/api/v1/media/' + res.body.id).as('member2').saveResponse('media/del').end(hlp.status(403, 'must be owner', done));
					});
			});
		});

		it('should succeed if the backglass is owned', function(done) {
			const user = 'member';
			hlp.file.createBackglass(user, request, function(bg) {
				request
					.post('/api/v1/media')
					.as(user)
					.send({
						_ref: { game: game.id },
						_file: bg.id,
						category: 'backglass_image'
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						request.del('/api/v1/media/' + res.body.id).as(user).save('media/del').end(hlp.status(204, done));
					});
			});
		});

		it('should succeed as moderator', function(done) {
			const user = 'member';
			hlp.file.createBackglass(user, request, function(bg) {
				request
					.post('/api/v1/media')
					.as(user)
					.send({
						_ref: { game: game.id },
						_file: bg.id,
						category: 'backglass_image'
					})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						request.del('/api/v1/media/' + res.body.id).as('contributor').end(hlp.status(204, done));
					});
			});
		});

	});
});

describe('When dealing with pre-processing media', function() {

	describe('of a release', function() {

		var game, vptfile;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.game.createGame('contributor', request, function(g) {
					game = g;
					hlp.file.createVpt('member', request, function(v) {
						vptfile = v;
						hlp.doomFile('member', vptfile.id);
						done();
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when providing a ws playfield for a fs file', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]

					}).end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'orientation is set to fs');
						done();
					});
			});
		});

		it('should fail when providing a fs playfield for a ws file', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'orientation is set to ws');
						done();
					});
			});
		});

		it('should fail when image orientation for playfield-fs is ws', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', 'playfield-ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'should be portrait');
						done();
					});
			});
		});

		it('should fail when image orientation for playfield-ws is fs', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', 'playfield-ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'should be portrait');
						done();
					});
			});
		});

		it('should fail when providing incorrect rotation parameters', function(done) {
			var user = 'member';
			request
				.post('/api/v1/releases?rotate=foobar!')
				.as(user)
				.send({}).end(hlp.status(400, "must be separated by", done));
		});

		it('should fail when providing incorrect rotation angle', function(done) {
			var user = 'member';
			request
				.post('/api/v1/releases?rotate=foobar:45')
				.as(user)
				.send({}).end(hlp.status(400, "wrong angle", done));
		});

		it('should fail when trying to rotate a non-existing image', function(done) {
			var user = 'member';
			request
				.post('/api/v1/releases?rotate=non-existent:90')
				.as(user)
				.send({}).end(hlp.status(404, "non-existing file", done));
		});

	});
});