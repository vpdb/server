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

describe('The VPDB `release` API', function() {

	describe('when posting a new release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail validations for empty release', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_game', 'must be provided');
					hlp.expectValidationError(err, res, 'name', 'must be provided');
					hlp.expectValidationError(err, res, 'versions', 'at least one version');
					hlp.expectValidationError(err, res, 'authors', 'at least one author');
					done();
				});
		});

		it('should fail validations for empty version', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ versions: [ { } ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.version', 'must be provided');
					hlp.expectValidationError(err, res, 'versions.0.files', 'at least one');
					done();
				});
		});

		it('should fail validations for empty file', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ versions: [ { files: [ { } ] } ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.files.0._file', 'must provide a file reference');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0.flavor.orientation');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0.flavor.lightning');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0._media.playfield_image');
					done();
				});
		});

		it('should fail validations when providing valid file reference with invalid meta data', function(done) {
			hlp.file.createVpt('member', request, function(vptfile) {
				request
					.post('/api/v1/releases')
					.as('member')
					.send({ versions: [ {
						files: [
							{ _file: vptfile.id },
							{ _file: vptfile.id, flavor: {} },
							{ _file: vptfile.id, flavor: { orientation: 'invalid' } },
							{ _file: vptfile.id },
							{ _file: vptfile.id, _compatibility: [ 'non-existent' ] }
						]
					} ] })
					.end(function(err, res) {
						hlp.doomFile('member', vptfile.id);
						hlp.expectValidationError(err, res, 'versions', 'reference a file multiple times');
						hlp.expectValidationError(err, res, 'versions.0.files.0.flavor.orientation', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.0.flavor.lightning', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.0._compatibility', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.orientation', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.lightning', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.2.flavor.orientation', 'invalid orientation');
						hlp.expectValidationError(err, res, 'versions.0.files.3._compatibility', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.4._compatibility.0', 'no such vpbuild');
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'must be provided');
						done();
					});
			});
		});

		it('should fail validations when providing invalid file references', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ versions: [ { files: [ { _file: 'non-existent' } ] } ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.files.0._file', 'no such file');
					done();
				});
		});

		it('should fail validations when providing invalid tag references', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ _tags: [ 'dof', 'non-existent' ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, '_tags.1', 'no such tag');
					done();
				});
		});

		it('should fail validations when providing the same flavor combination more than once.');

		it('should fail accordingly when providing only non-table files', function (done) {
			hlp.file.createTextfile('member', request, function (textfile1) {
				hlp.file.createTextfile('member', request, function (textfile2) {
					hlp.file.createVpt('member', request, function (vptfile) {
						request
							.post('/api/v1/releases')
							.as('member')
							.send({ versions: [
								{ files: [
									{ _file: textfile1.id },
									{ _file: vptfile.id }
								] },
								{ files: [
									{ _file: textfile2.id }
								] }
							] })
							.end(function (err, res) {
								hlp.doomFile('member', textfile1.id);
								hlp.doomFile('member', textfile2.id);
								hlp.doomFile('member', vptfile.id);
								hlp.expectValidationError(err, res, 'versions.1.files', 'at least one table file');
								hlp.expectNoValidationError(err, res, 'versions.1.files.0.flavor.orientation', 'must be provided');
								hlp.expectNoValidationError(err, res, 'versions.1.files.0.flavor.lightning', 'must be provided');
								hlp.expectNoValidationError(err, res, 'versions.1.files.0._media.playfield_image', 'must be provided');
								done();
							});
					});
				});
			});
		});

		it('should succeed when providing minimal data', function(done) {
			var user = 'member';
			hlp.game.createGame('contributor', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, function(playfield) {
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
											flavor: { orientation: 'fs', lightning: 'night' } }
										],
										version: '1.0.0'
									}
								],
								authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
							})
							.end(function (err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRelease(user, res.body.id);
								hlp.doomGame('contributor', game.id);
								done();
							});
					});
				});
			});
		});

		it('should success when providing full data', function(done) {
			var user = 'member';
			hlp.game.createGame('contributor', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, function(playfieldImage) {
						hlp.file.createMp4(user, request, function(playfieldVideo) {
							request
								.post('/api/v1/releases')
								.save({ path: 'releases/create'})
								.as(user)
								.send({
									name: 'release',
									_game: game.id,
									versions: [
										{
											files: [ {
												_file: vptfile.id,
												_media: {
													playfield_image: playfieldImage.id,
													playfield_video: playfieldVideo.id
												},
												_compatibility: [ '9.9.0' ],
												flavor: { orientation: 'fs', lightning: 'night' } }
											],
											version: '1.0.0'
										}
									],
									authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ],
									_tags: [ 'hd', 'dof' ]
								})
								.end(function (err, res) {
									hlp.expectStatus(err, res, 201);
									hlp.doomRelease(user, res.body.id);
									hlp.doomGame('contributor', game.id);
									done();
								});
						});
					});
				});
			});
		});

	});
});