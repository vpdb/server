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

	describe('when creating a new release', function() {

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
					hlp.expectNoValidationError(err, res, 'versions.0.files.0.flavor.lighting');
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
						hlp.expectValidationError(err, res, 'versions.0.files.0.flavor.lighting', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.0._compatibility', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.orientation', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.lighting', 'must be provided');
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
								hlp.expectNoValidationError(err, res, 'versions.1.files.0.flavor.lighting', 'must be provided');
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
											flavor: { orientation: 'fs', lighting: 'night' } }
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
					hlp.file.createPlayfields(user, request, 'fs', 2, function(playfieldImages) {
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
												flavor: { orientation: 'fs', lighting: 'night' }

											}, {
												_file: vptfiles[1].id,
												_media: {
													playfield_image: playfieldImages[1].id
												},
												_compatibility: [ '9.9.0' ],
												flavor: { orientation: 'fs', lighting: 'day' }
											} ],
											version: '1.0.0',
											released_at: '2015-08-01T00:00:00.000Z'
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

		it('should correctly inherit release date if set', function(done) {
			var user = 'member';
			var date1 = '2015-01-01T00:00:00.000Z';
			var date2 = '2015-08-01T00:00:00.000Z';

			hlp.game.createGame('contributor', request, function(game) {
				hlp.file.createVpts(user, request, 2, function(vptfiles) {
					hlp.file.createPlayfields(user, request, 'fs', 2, function(playfieldImages) {
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
											released_at: date1,
											_file: vptfiles[0].id,
											_media: {
												playfield_image: playfieldImages[0].id,
											},
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'fs', lighting: 'night' }

										}, {
											_file: vptfiles[1].id,
											_media: {
												playfield_image: playfieldImages[1].id
											},
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'fs', lighting: 'day' }
										} ],
										version: '1.0.0',
										released_at: date2
									}
								],
								authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ],
								_tags: [ 'hd', 'dof' ]
							})
							.end(function (err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRelease(user, res.body.id);

								expect(res.body.versions[0].released_at).to.be(date2);
								expect(res.body.versions[0].files[0].released_at).to.be(date1);
								expect(res.body.versions[0].files[1].released_at).to.be(date2);
								done();
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
				member2: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when logged as a different user', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request.post('/api/v1/releases/' + release.id + '/versions')
					.as('member2')
					.send({})
					.saveResponse({ path: 'releases/create-version'})
					.end(hlp.status(403, 'only authors of the release', done));
			});
		});

		it('should fail validations when providing valid file reference with invalid meta data', function(done) {

			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
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
							hlp.expectValidationError(err, res, 'files.0.flavor.lighting', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0._compatibility', 'must be provided');
							hlp.expectValidationError(err, res, 'files.1.flavor.orientation', 'must be provided');
							hlp.expectValidationError(err, res, 'files.1.flavor.lighting', 'must be provided');
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
							flavor: { orientation: 'fs', lighting: 'night' }
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
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function (playfield) {
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
									flavor: { orientation: 'fs', lighting: 'night' }
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

	describe('when updating an existing version of a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when logged as a different user', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request.put('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
					.as('member2')
					.send({})
					.saveResponse({ path: 'releases/update-version'})
					.end(hlp.status(403, 'only authors of the release', done));
			});
		});

		it('should fail for duplicate compat/flavor', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				var versionFile = release.versions[0].files[0];
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
						var data = {
							files: [{
								_file: vptfile.id,
								_media: { playfield_image: playfield.id },
								_compatibility: _.pluck(versionFile.compatibility, 'id'),
								flavor: versionFile.flavor
							}]
						};
						request
							.put('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
							.saveResponse({ path: 'releases/update-version'})
							.as(user)
							.send(data).end(function(err, res) {
								hlp.expectValidationError(err, res, 'files.0._compatibility', 'compatibility and flavor already exists');
								hlp.expectValidationError(err, res, 'files.0.flavor', 'compatibility and flavor already exists');
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
					hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
						request
							.put('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
							.save({ path: 'releases/update-version'})
							.as(user)
							.send({
								files: [{
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: ['9.9.0'],
									flavor: { orientation: 'fs', lighting: 'day' }
								}]
							}).end(hlp.status(201, done));
					});
				});
			});
		});

		it('should fail when data is missing', function(done) {
			var user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.file.createVpt(user, request, function(vptfile) {
					request
						.put('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
						.as(user)
						.send({
							files: [{
								_file: vptfile.id,
								flavor: {},
								_compatibility: [],
								_media: { playfield_image: null, playfield_video: null }
							}]
						}).end(function(err, res) {
							hlp.expectValidationError(err, res, 'files.0._compatibility', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0._media.playfield_image', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0.flavor.lighting', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0.flavor.orientation', 'must be provided');
							done();
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
						expect(release.thumb).to.not.be.ok();
						done();
					});
			});
		});

		it('should include thumb if format is given', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.get('/api/v1/releases/' + release.id + '?thumb_format=square')
					.save({ path: 'releases/view'})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						release = res.body;
						expect(res.body).to.be.an('object');
						expect(release.id).to.be.ok();
						expect(release.name).to.be.ok();
						expect(release.thumb).to.be.an('object');
						expect(release.thumb.image).to.be.an('object');
						expect(release.thumb.image.url).to.contain('/square/');
						done();
					});
			});
		});

		it('should include thumb if flavor is given', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.get('/api/v1/releases/' + release.id + '?thumb_flavor=orientation:fs')
					.save({ path: 'releases/view'})
					.end(function(err, res) {

						hlp.expectStatus(err, res, 200);
						release = res.body;
						expect(res.body).to.be.an('object');
						expect(release.id).to.be.ok();
						expect(release.name).to.be.ok();
						expect(release.thumb).to.be.an('object');
						expect(release.thumb.flavor).to.be.an('object');
						expect(release.thumb.flavor.orientation).to.be('fs');
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

		var numReleases = 4;
		var releases;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.release.createReleases('member', request, numReleases, function(r) {
					releases = r;
					done(null, r);
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
						expect(release.authors[0]._user).to.not.be.ok();
					});
					done();
				});
		});

		it('should return the nearest thumb match of widescreen/night', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					var rls1 = _.findWhere(res.body, { id: releases[0].id });
					var rls2 = _.findWhere(res.body, { id: releases[1].id });
					var rls3 = _.findWhere(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].media.playfield_image.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].media.playfield_image.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].media.playfield_image.url);

					done();
				});
		});

		it('should return the nearest thumb match of widescreen/night in the correct format', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night&thumb_format=medium')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					var rls1 = _.findWhere(res.body, { id: releases[0].id });
					var rls2 = _.findWhere(res.body, { id: releases[1].id });
					var rls3 = _.findWhere(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].media.playfield_image.variations.medium.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].media.playfield_image.variations.medium.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].media.playfield_image.variations.medium.url);

					done();
				});
		});

		it('should return the nearest thumb match of night/widescreen', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					var rls1 = _.findWhere(res.body, { id: releases[0].id });
					var rls2 = _.findWhere(res.body, { id: releases[1].id });
					var rls3 = _.findWhere(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].media.playfield_image.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[0].media.playfield_image.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].media.playfield_image.url);

					done();
				});
		});

		it('should return the a thumb of an older version if the newer version has no such thumb', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					var rls4 = _.findWhere(res.body, { id: releases[3].id });
					expect(rls4.thumb.image.url).to.be(releases[3].versions[1].files[0].media.playfield_image.url);

					done();
				});
		});

		it('should return square thumb format', function(done) {
			request
				.get('/api/v1/releases?thumb_format=square')
				.save({ path: 'releases/list'})
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					for (var i = 0; i < numReleases; i++) {
						expect(res.body[i].thumb.image.url).to.contain('/square/');
					}
					done();
				});
		});

		it('should deny access to starred releases when not logged', function(done) {
			request.get('/api/v1/releases?starred').saveResponse({ path: 'releases/list'}).end(hlp.status(401, done));
		});

		it('should list only starred releases', function(done) {

			request.get('/api/v1/releases?starred').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(res.body).to.be.empty();

				request.post('/api/v1/releases/' + releases[0].id + '/star').send({}).as('member').end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					request.get('/api/v1/releases?starred').as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body).to.have.length(1);
						expect(res.body[0].id).to.be(releases[0].id);

						request.get('/api/v1/releases?starred=false').as('member').end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.have.length(numReleases - 1);
							expect(res.body[0].id).not.to.be(releases[0].id);
							expect(res.body[1].id).not.to.be(releases[0].id);
							done();
						});
					});
				});
			});
		});

		it('should list only releases for given IDs', function(done) {
			var ids = [ releases[0].id, releases[1].id ];
			request.get('/api/v1/releases?ids=' + ids.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(res.body).to.have.length(ids.length);
				expect(_.findWhere(res.body, { id: releases[0].id })).to.be.ok();
				expect(_.findWhere(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only tagged releases', function(done) {

			var tags = [ 'dof' ];

			request.get('/api/v1/releases?tags=' + tags.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				var tagFilter = tags.map(function(tag) { return { id: tag }; });
				var taggedReleases = _.filter(releases, { tags: tagFilter });
				expect(res.body).to.have.length(taggedReleases.length);
				for (var i = 0; i < taggedReleases.length; i++) {
					expect(_.findWhere(res.body, { id: taggedReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only tagged releases for multiple tags', function(done) {

			var tags = [ 'dof', 'wip' ];

			request.get('/api/v1/releases?tags=' + tags.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				var tagFilter = tags.map(function(tag) { return { id: tag }; });
				var taggedReleases = _.filter(releases, { tags: tagFilter });
				expect(res.body).to.have.length(taggedReleases.length);
				for (var i = 0; i < taggedReleases.length; i++) {
					expect(_.findWhere(res.body, { id: taggedReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only releases whose name matches a query', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].name).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.findWhere(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only releases whose game title matches a query', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].game.title).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.findWhere(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should fail for queries less than 3 characters', function(done) {
			request.get('/api/v1/releases?q=12').end(hlp.status(400, done));
		});

		it('should succeed for queries more than 2 character', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].name.substr(0, 3)).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.findWhere(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only a given flavor', function(done) {

			request.get('/api/v1/releases?flavor=orientation:ws').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.findWhere(res.body, { id: releases[0].id })).to.not.be.ok();
				expect(_.findWhere(res.body, { id: releases[1].id })).to.be.ok();
				expect(_.findWhere(res.body, { id: releases[2].id })).to.be.ok();
				done();
			});
		});

		it('should list only releases for a given build', function(done) {

			var builds = [ '10.x' ];
			request.get('/api/v1/releases?builds=' + builds.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				var filteredReleases = [];
				_.each(builds, function(build) {
					filteredReleases = filteredReleases.concat(_.filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
				});
				expect(res.body).to.have.length(filteredReleases.length);
				for (var i = 0; i < filteredReleases.length; i++) {
					expect(_.findWhere(res.body, { id: filteredReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only releases for multiple builds', function(done) {

			var builds = [ '10.x', 'physmod5' ];
			request.get('/api/v1/releases?builds=' + builds.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				var filteredReleases = [];
				_.each(builds, function(build) {
					filteredReleases = filteredReleases.concat(_.filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
				});
				expect(res.body).to.have.length(filteredReleases.length);
				for (var i = 0; i < filteredReleases.length; i++) {
					expect(_.findWhere(res.body, { id: filteredReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should only list releases with table files of a given size');
		it('should only list releases with table files of a given size and threshold');

	});
});