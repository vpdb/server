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
						hlp.expectValidationError(err, res, 'versions.0.files.4._compatibility.0', 'no such build');
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'must be provided');
						done();
					});
			});
		});

		it('should fail validations when providing a non-existing file reference', function(done) {
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

		it('should fail validations when providing the same flavor/compat combination more than once.');

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

		it('should fail validations when providing a different file type as playfield image', function(done) {
			var user = 'member';
			hlp.file.createVpt(user, request, function(vptfile) {
				hlp.file.createBackglass(user, request, function(backglass) {
					hlp.doomFile(user, backglass.id);
					request
						.post('/api/v1/releases')
						.as(user)
						.send({
							versions: [ {
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: backglass.id }
								} ]
							} ]
						})
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'file_type "playfield-fs" or "playfield-ws"');
							done();
						});
				});
			});
		});

		it('should fail validations when providing a different file type as playfield video');
		it('should fail validations when providing a non-existent build');
		it('should fail validations when providing a non-existent playfield video');

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
								done();
							});
					});
				});
			});
		});

		it('should succeed when providing full data', function(done) {
			var user = 'member';
			hlp.game.createGame('contributor', request, function(game) {
				hlp.file.createVpts(user, request, 2, function(vptfiles) {
					hlp.file.createPlayfields(user, request, 2, function(playfieldImages) {
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
												_file: vptfiles[0].id,
												_media: {
													playfield_image: playfieldImages[0].id,
													playfield_video: playfieldVideo.id
												},
												_compatibility: [ '9.9.0' ],
												flavor: { orientation: 'fs', lightning: 'night' }

											}, {
												_file: vptfiles[1].id,
												_media: {
													playfield_image: playfieldImages[1].id
												},
												_compatibility: [ '9.9.0' ],
												flavor: { orientation: 'fs', lightning: 'day' }
											} ],
											version: '1.0.0'
										}
									],
									authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ],
									_tags: [ 'hd', 'dof' ]
								})
								.end(function (err, res) {
									hlp.expectStatus(err, res, 201);
									hlp.doomRelease(user, res.body.id);

									expect(res.body.versions[0].files[0].media.playfield_image.is_active).to.be(true);
									expect(res.body.versions[0].files[0].media.playfield_video.is_active).to.be(true);
									expect(res.body.versions[0].files[1].media.playfield_image.is_active).to.be(true);
									done();
								});
						});
					});
				});
			});
		});

		it('should activate tags and builds if created');

	});

	describe('when adding a new version to an existing release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when logged as a different user', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				hlp.doomRelease('member', release.id);
				request.post('/api/v1/releases/' + release.id + '/versions')
					.as('othermember')
					.send({})
					.saveResponse({ path: 'releases/create-version'})
					.end(hlp.status(403, 'only authors of the release', done));
			});
		});

		it('should fail validations when providing valid file reference with invalid meta data', function(done) {

			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.doomRelease(user, release.id);
				hlp.file.createVpt('member', request, function(vptfile) {
					hlp.doomFile(user, vptfile.id);
					request
						.post('/api/v1/releases/' + release.id + '/versions')
						.as(user)
						.send({
							version: '2.0.0',
							changes: '*Second release.*',
							files: [
								{ _file: vptfile.id },
								{ _file: vptfile.id, flavor: {} },
								{ _file: vptfile.id, flavor: { orientation: 'invalid' } },
								{ _file: vptfile.id },
								{ _file: vptfile.id, _compatibility: [ 'non-existent' ] }
							]
						}).end(function(err, res) {
							hlp.expectValidationError(err, res, 'files.0.flavor.orientation', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0.flavor.lightning', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0._compatibility', 'must be provided');
							hlp.expectValidationError(err, res, 'files.1.flavor.orientation', 'must be provided');
							hlp.expectValidationError(err, res, 'files.1.flavor.lightning', 'must be provided');
							hlp.expectValidationError(err, res, 'files.2.flavor.orientation', 'invalid orientation');
							hlp.expectValidationError(err, res, 'files.3._compatibility', 'must be provided');
							hlp.expectValidationError(err, res, 'files.4._compatibility.0', 'no such build');
							hlp.expectValidationError(err, res, 'files.0._media.playfield_image', 'must be provided');
							done();
						});
				});
			});
		});

		it('should fail when adding an existing version', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.doomRelease(user, release.id);
				request
					.post('/api/v1/releases/' + release.id + '/versions')
					.as(user)
					.saveResponse({ path: 'releases/create-version'})
					.send({
						version: '1.0.0',
						changes: '*Second release.*',
						files: [ {
							_file: '12345',
							_media: { playfield_image: '67890' },
							_compatibility: [ '9.9.0' ],
							flavor: { orientation: 'fs', lightning: 'night' }
						} ]
					}).end(function(err, res) {
						hlp.expectValidationError(err, res, 'version', 'version already exists');
						done();
					});
			});
		});

		it('should succeed when providing valid data', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.doomRelease(user, release.id);
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, function (playfield) {
						request
							.post('/api/v1/releases/' + release.id + '/versions')
							.save({ path: 'releases/create-version'})
							.as(user)
							.send({
								version: '2.0.0',
								changes: '*Second release.*',
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lightning: 'night' }
								} ]
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 201);
								var version = res.body;
								expect(version).to.be.ok();
								expect(version.changes).to.be('*Second release.*');
								done();
							});
					});
				});
			});
		});
	});


	describe('when adding a new file to an existing version of an existing release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when logged as a different user', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				hlp.doomRelease('member', release.id);
				request.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files')
					.as('othermember')
					.send({})
					.saveResponse({ path: 'releases/create-file'})
					.end(hlp.status(403, 'only authors of the release', done));
			});
		});

		it('should fail for duplicate compat/flavor', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				var versionFile = release.versions[0].files[0];
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, function(playfield) {
						request
							.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files')
							.saveResponse({ path: 'releases/create-file'})
							.as(user)
							.send({
								_file: vptfile.id,
								_media: { playfield_image: playfield.id },
								_compatibility: _.pluck(versionFile.compatibility, 'id'),
								flavor: versionFile.flavor
							}).end(function(err, res) {
								hlp.doomRelease(user, release.id);
								hlp.expectValidationError(err, res, '_compatibility', 'compatibility and flavor already exist');
								hlp.expectValidationError(err, res, 'flavor', 'compatibility and flavor already exist');
								done();
							});
					});
				});
			});
		});

		it('should succeed when providing valid data', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, function(playfield) {
						request
							.post('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version + '/files')
							.save({ path: 'releases/create-file'})
							.as(user)
							.send({
								_file: vptfile.id,
								_media: { playfield_image: playfield.id },
								_compatibility: [ '9.9.0' ],
								flavor: { orientation: 'fs', lightning: 'day' }
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRelease(user, release.id);
								done();
							});
					});
				});
			});
		});
	});

	describe('when viewing a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list all fields', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.get('/api/v1/releases/' + release.id)
					.save({ path: 'releases/view'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						release = res.body;
						expect(res.body).to.be.an('object');
						expect(release.id).to.be.ok();
						expect(release.name).to.be.ok();
						expect(release.created_at).to.be.ok();
						expect(release.authors).to.be.an('array');
						expect(release.authors[0]).to.be.an('object');
						expect(release.authors[0].roles).to.be.an('array');
						expect(release.authors[0].user).to.be.an('object');
						expect(release.authors[0].user.id).to.be.ok();
						expect(release.authors[0].user.name).to.be.ok();
						expect(release.authors[0].user.username).to.be.ok();
						done();
					});
			});
		});
	});

	describe('when downloading a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				countertest: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should update all the necessary download counters.', function(done) {

			hlp.release.createRelease('contributor', request, function(release) {
				var url = '/storage/v1/releases/' + release.id;
				var body = {
					files: [ release.versions[0].files[0].file.id ],
					media: {
						playfield_image: false,
						playfield_video: false
					},
					game_media: false
				};
				hlp.storageToken(request, 'countertest', url, function(token) {
					request.get(url).query({ token: token, body: JSON.stringify(body) }).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						var tests = [];

						// game downloads
						tests.push(function(next) {
							request.get('/api/v1/games/' + release.game.id).end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.counter.downloads).to.be(1);
								next();
							});
						});

						// release / file downloads
						tests.push(function(next) {
							request.get('/api/v1/releases/' + release.id).end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.counter.downloads).to.be(1);
								expect(res.body.versions[0].counter.downloads).to.be(1);
								expect(res.body.versions[0].files[0].counter.downloads).to.be(1);
								expect(res.body.versions[0].files[0].file.counter.downloads).to.be(1);
								next();
							});
						});

						// check user counter
						tests.push(function(next) {
							request.get('/api/v1/user').as('countertest').end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.counter.downloads).to.be(1);
								next();
							});
						});

						async.series(tests, done);
					});
				});
			});
		});
	});

	describe('when listing releases', function() {

		var numReleases = 3;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.release.createReleases('member', request, numReleases, function(releases) {
					done(null, releases);
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list all fields', function(done) {
			request
				.get('/api/v1/releases')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(numReleases);
					_.each(res.body, function(release) {
						expect(release.id).to.be.ok();
						expect(release.name).to.be.ok();
						expect(release.created_at).to.be.ok();
						expect(release.authors).to.be.an('array');
						expect(release.authors[0]).to.be.an('object');
						expect(release.authors[0].roles).to.be.an('array');
						expect(release.authors[0].user).to.be.an('object');
						expect(release.authors[0].user.id).to.be.ok();
						expect(release.authors[0].user.name).to.be.ok();
						expect(release.authors[0].user.username).to.be.ok();
					});
					done();
				});
		});

	});
});