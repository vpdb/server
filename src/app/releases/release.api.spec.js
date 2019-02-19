/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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
const gm = require('gm');
const request = require('superagent');
const expect = require('expect.js');
const pleasejs = require('pleasejs');

const superagentTest = require('../../test/legacy/superagent-test');
const hlp = require('../../test/legacy/helper');

superagentTest(request);

describe('The VPDB `Release` API', function() {

	describe('when creating a new release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
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
					hlp.expectNoValidationError(err, res, 'versions.0.files.0._playfield_image');
					done();
				});
		});

		it('should fail validations when providing valid file reference with invalid meta data', function(done) {
			hlp.file.createVpt('member', request, function(vptfile) {
				request
					.post('/api/v1/releases')
					.as('member')
					.saveResponse({ path: 'releases/create' })
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
						hlp.expectValidationError(err, res, 'versions.0.files.0._playfield_image', 'must be provided');
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
								hlp.expectNoValidationError(err, res, 'versions.1.files.0._playfield_image', 'must be provided');
								done();
							});
					});
				});
			});
		});

		it('should fail validations when providing a different file type as playfield image', function(done) {
			const user = 'member';
			hlp.file.createVpt(user, request, function(vptfile) {
				gm(1080, 1920, pleasejs.make_color()).toBuffer('PNG', function(err, data) {
					if (err) {
						throw err;
					}
					request
						.post('/storage/v1/files')
						.query({ type: 'backglass' })
						.type('image/png')
						.set('Content-Disposition', 'attachment; filename="wrontype.png"')
						.set('Content-Length', data.length)
						.send(data)
						.as(user)
						.end(function(err, res) {
							const playfieldId = res.body.id;
							expect(err).to.not.be.ok();
							expect(res.status).to.be(201);
							hlp.doomFile(user, playfieldId);
							request
								.post('/api/v1/releases')
								.as(user)
								.send({
									versions: [{
										files: [{
											_file: vptfile.id,
											_playfield_image: playfieldId
										}]
									}]
								})
								.end(function(err, res) {
									hlp.expectValidationError(err, res, 'versions.0.files.0._playfield_image', 'file_type "playfield-fs" or "playfield-ws"');
									done();
								});
						});
				});
			});
		});

		it('should fail validations when providing a playfield image with the wrong aspect ratio', function(done) {
			const user = 'member';
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
									_playfield_image: backglass.id
								} ]
							} ]
						})
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'versions.0.files.0._playfield_image', 'have an aspect ratio between');
							done();
						});
				});
			});
		});

		it('should fail when providing the same build twice', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
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
											_playfield_image: playfield.id,
											_compatibility: [ '9.9.0', '9.9.0' ],
											flavor: { orientation: 'fs', lighting: 'night' } }
										],
										version: '1.0.0'
									}
								],
								authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
							})
							.end(function (err, res) {
								hlp.expectValidationError(err, res, 'versions.0.files.0._compatibility', 'multiple times');
								done();
							});
					});
				});
			});
		});

		it('should fail validations when providing a different file type as playfield video');
		it('should fail validations when providing a non-existent build');
		it('should fail validations when providing a non-existent playfield video');

		it('should succeed when providing minimal data', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
						request
							.post('/api/v1/releases')
							.as(user)
							.send({
								name: 'release',
								license: 'by-sa',
								_game: game.id,
								versions: [
									{
										files: [ {
											_file: vptfile.id,
											_playfield_image: playfield.id,
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
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpts(user, request, 2, function(vptfiles) {
					hlp.file.createPlayfields(user, request, 'fs', 2, function(playfieldImages) {
						hlp.file.createMp4(user, request, function(playfieldVideo) {
							hlp.file.createMp3(user, request, function(mp3) {
								request
									.post('/api/v1/releases')
									.save({ path: 'releases/create' })
									.as(user)
									.send({
										name: 'release',
										license: 'by-sa',
										_game: game.id,
										versions: [
											{
												files: [ {
													_file: vptfiles[0].id,
													_playfield_image: playfieldImages[0].id,
													_playfield_video: playfieldVideo.id,
													_compatibility: [ '9.9.0' ],
													flavor: { orientation: 'fs', lighting: 'night' }

												}, {
													_file: vptfiles[1].id,
													_playfield_image: playfieldImages[1].id,
													_compatibility: [ '9.9.0' ],
													flavor: { orientation: 'fs', lighting: 'day' }
												}, {
													_file: mp3.id
												} ],
												version: '1.0.0',
												released_at: '2015-08-01T00:00:00.000Z'
											}
										],
										authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ],
										_tags: [ 'hd', 'dof' ]
									})
									.end(function(err, res) {
										hlp.expectStatus(err, res, 201);
										hlp.doomRelease(user, res.body.id);

										expect(res.body.versions[0].files[0].playfield_image.is_active).to.be(true);
										expect(res.body.versions[0].files[0].playfield_video.is_active).to.be(true);
										expect(res.body.versions[0].files[1].playfield_image.is_active).to.be(true);
										done();
									});
							});
						});
					});
				});
			});
		});

		it('should correctly inherit release date if set', function(done) {
			const user = 'member';
			const date1 = '2015-01-01T00:00:00.000Z';
			const date2 = '2015-08-01T00:00:00.000Z';

			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpts(user, request, 2, function(vptfiles) {
					hlp.file.createPlayfields(user, request, 'fs', 2, function(playfieldImages) {
						request
							.post('/api/v1/releases')
							.as(user)
							.send({
								name: 'release',
								license: 'by-sa',
								_game: game.id,
								versions: [
									{
										files: [ {
											released_at: date1,
											_file: vptfiles[0].id,
											_playfield_image: playfieldImages[0].id,
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'fs', lighting: 'night' }

										}, {
											_file: vptfiles[1].id,
											_playfield_image: playfieldImages[1].id,
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

		it('should succeed using a fs playfield for universal orientation', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', 'playfield', function(playfield) {
						expect(playfield.metadata.size.width).to.be(1080);
						expect(playfield.metadata.size.height).to.be(1920);
						request
							.post('/api/v1/releases')
							.query({ rotate: playfield.id + ':0' })
							.as(user)
							.send({
								name: 'release',
								license: 'by-sa',
								_game: game.id,
								versions: [
									{
										files: [ {
											_file: vptfile.id,
											_playfield_image: playfield.id,
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'any', lighting: 'any' } }
										],
										version: '1.0.0'
									}
								],
								authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
							})
							.end(function (err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRelease(user, res.body.id);
								let playfieldRelease = res.body.versions[0].files[0].playfield_image;
								expect(playfieldRelease.metadata.size.width).to.be(1080);
								expect(playfieldRelease.metadata.size.height).to.be(1920);
								request.get(playfieldRelease.variations.medium.url).end((err, res) => {
									hlp.expectStatus(err, res, 200);
									gm(res.body).size((err, size) => {
										if (err) {
											throw err;
										}
										expect(size.width).to.be.lessThan(size.height);
										done();
									})
								});
							});
					});
				});
			});
		});

		it('should succeed when rotating a ws playfield to a fs file', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'ws', 'playfield', function(playfield) {
						expect(playfield.metadata.size.width).to.be(1920);
						expect(playfield.metadata.size.height).to.be(1080);
						request
							.post('/api/v1/releases')
							.query({ rotate: playfield.id + ':90' })
							.as(user)
							.send({
								name: 'release',
								license: 'by-sa',
								_game: game.id,
								versions: [
									{
										files: [ {
											_file: vptfile.id,
											_playfield_image: playfield.id,
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
								let playfieldRotated = res.body.versions[0].files[0].playfield_image;
								expect(playfieldRotated.metadata.size.width).to.be(1080);
								expect(playfieldRotated.metadata.size.height).to.be(1920);
								request.get(playfieldRotated.variations.full.url).end((err, res) => {
									hlp.expectStatus(err, res, 200);
									gm(res.body).size((err, size) => {
										if (err) {
											throw err;
										}
										expect(size.width).to.be(1080);
										expect(size.height).to.be(1920);
										done();
									})
								});
							});
					});
				});
			});
		});

		it('should succeed when rotating a fs playfield to a ws file', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', 'playfield', function(playfield) {
						request
							.post('/api/v1/releases')
							.query({ rotate: playfield.id + ':90' })
							.as(user)
							.send({
								name: 'release',
								license: 'by-sa',
								_game: game.id,
								versions: [
									{
										files: [ {
											_file: vptfile.id,
											_playfield_image: playfield.id,
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'ws', lighting: 'night' } }
										],
										version: '1.0.0'
									}
								],
								authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
							})
							.end(function (err, res) {
								hlp.expectStatus(err, res, 201);
								hlp.doomRelease(user, res.body.id);
								let playfieldRotated = res.body.versions[0].files[0].playfield_image;
								expect(playfield.metadata.size.width).to.be(playfieldRotated.metadata.size.height);
								expect(playfield.metadata.size.height).to.be(playfieldRotated.metadata.size.width);
								done();
							});
					});
				});
			});
		});

		it('should fail when rotating playfield not belonging to the release', function(done) {
			const user = 'member';
			hlp.game.createGame('moderator', request, function(game) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', 'playfield', function(playfield) {
						hlp.file.createPlayfield(user, request, 'fs', 'playfield', function(playfieldOther) {
							request
								.post('/api/v1/releases')
								.query({ rotate: playfieldOther.id + ':90' })
								.as(user)
								.send({
									name: 'release',
									license: 'by-sa',
									_game: game.id,
									versions: [
										{
											files: [ {
												_file: vptfile.id,
												_playfield_image: playfield.id,
												_compatibility: [ '9.9.0' ],
												flavor: { orientation: 'ws', lighting: 'night' } }
											],
											version: '1.0.0'
										}
									],
									authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
								})
								.end(hlp.status(400, 'it is not part of the release', done));
						});
					});
				});
			});
		});

		it('should fail when providing a non-rotated and unspecified playfield image ("playfield" file_type)');

		it('should activate tags and builds if created');

	});

	describe('when updating an existing release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if not author or creator', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('othermember')
					.send({ name: 'New name' })
					.end(hlp.status(403, 'only authors and owners of the release can update it', done));
			});
		});

		it('should fail if an invalid release ID is provided', function(done) {
			request
				.patch('/api/v1/releases/non-existent')
				.as('member')
				.send({})
				.end(hlp.status(404, 'no such release', done));
		});

		it('should fail if an illegal attribute is provided', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ id: '1234', name: 'New name', versions: [] })
					.end(hlp.status(400, 'invalid field', done));
			});
		});

		it('should fail validations for illegal data', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ name: '', authors: 'i am a string but i should not!', links: 'i am also string!' })
					.end(function(err, res) {
						hlp.expectValidationError(err, res, 'name', 'must be provided');
						hlp.expectValidationError(err, res, 'authors', 'cast to array failed');
						hlp.expectValidationError(err, res, 'links', 'cast to array failed');
						done();
					});
			});
		});

		it('should succeed when updating text fields', function(done) {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.name).to.be(newName);
						expect(res.body.description).to.be(newDescription);
						expect(res.body.acknowledgements).to.be(newAcknowledgements);
						done();
					});
			});
		});

		it('should succeed when updating all fields', function(done) {
			const newName = 'Updated name';
			const newDescription = 'Updated description';
			const newAcknowledgements = 'Updated acknowledgements';
			const links = [
				{ label: 'first link', url: 'https://vpdb.io/somelink' },
				{ label: 'second link', url: 'https://vpdb.io/someotherlink' }
			];
			const newTags = ['hd', 'dof'];
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.save({ path: 'releases/update'})
					.send({
						name: newName,
						description: newDescription,
						acknowledgements: newAcknowledgements,
						authors: [ { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ],
						links: links,
						_tags: newTags
					}).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.name).to.be(newName);
						expect(res.body.description).to.be(newDescription);
						expect(res.body.acknowledgements).to.be(newAcknowledgements);
						expect(res.body.links).to.eql(links);
						expect(res.body.tags).to.be.an('array');
						expect(res.body.tags).to.have.length(newTags.length);
						newTags.forEach(tag => expect(_.find(res.body.tags, t => t.id === tag)).to.be.an('object'));
						expect(res.body.authors).to.have.length(1);
						expect(res.body.authors[0].user.id).to.be(hlp.getUser('othermember').id);
						done();
					});
			});
		});

		it('should succeed updating as non-creator but author', function(done) {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			hlp.release.createRelease('member', request, function(release) {
				let originalAuthors = release.authors.map(a => { return { _user: a.user.id, roles: a.roles };});
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ authors: [ ...originalAuthors, { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						request
							.patch('/api/v1/releases/' + release.id)
							.as('othermember')
							.send({ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.name).to.be(newName);
								expect(res.body.description).to.be(newDescription);
								expect(res.body.acknowledgements).to.be(newAcknowledgements);
								done();
							});
					});
			});
		});

		it('should succeed updating as non-creator but moderator', function(done) {
			const newName = 'My edited name';
			const newDescription = 'My edited description';
			const newAcknowledgements = 'My edited acknowledgements';
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('moderator')
					.send({ name: newName, description: newDescription, acknowledgements: newAcknowledgements })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.name).to.be(newName);
						expect(res.body.description).to.be(newDescription);
						expect(res.body.acknowledgements).to.be(newAcknowledgements);
						done();
					});
			});
		});

		it('should fail for a non-existing tag', function(done) {
			const newTags = ['hd', 'i-dont-exist'];
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ _tags: newTags })
					.end(function(err, res) {
						hlp.expectValidationError(err, res, '_tags.1', 'no such tag');
						done();
					});
			});
		});

		it('should succeed when updating tags', function(done) {
			const newTags = ['hd', 'dof'];
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ _tags: newTags })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.tags).to.be.an('array');
						expect(res.body.tags).to.have.length(newTags.length);
						newTags.forEach(tag => expect(_.find(res.body.tags, t => t.id === tag)).to.be.an('object'));
						done();
					});
			});
		});

		it('should succeed when updating links', function(done) {
			const links = [
				{ label: 'first link', url: 'https://vpdb.io/somelink' },
				{ label: 'second link', url: 'https://vpdb.io/someotherlink' }
			];
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ links: links })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.links).to.eql(links);
						done();
					});
			});
		});

		it('should fail when updating author as non-creator but other author', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ authors: [ { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						request
							.patch('/api/v1/releases/' + release.id)
							.as('othermember')
							.send({ authors: [] })
							.end(hlp.status(403, 'only the original uploader', done));
					});
			});
		});

		it('should succeed when updating authors', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id)
					.as('member')
					.send({ authors: [ { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.authors).to.have.length(1);
						expect(res.body.authors[0].user.id).to.be(hlp.getUser('othermember').id);
						done();
					});
			});
		});

	});

	describe('when viewing a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should list all fields', function(done) {
			hlp.release.createRelease('contributor', request, function(release) {
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
			hlp.release.createRelease('contributor', request, function(release) {
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
			hlp.release.createRelease('contributor', request, function(release) {
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

	describe('when listing releases', function() {

		const numReleases = 4;
		let releases;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				providerUser: { roles: [ 'contributor' ] },
				moderator: { roles: [ 'moderator', 'contributor' ] },
				admin: { roles: [ 'admin' ] }
			}, function() {
				hlp.release.createReleases('moderator', request, numReleases - 1, function(r) {
					releases = r;
					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: {
								provider: 'github',
								id: '11234',
								displayName: 'Motörhead Dude-23',
								username: 'motorhead',
								profileUrl: 'https://github.com/mockuser',
								emails: [
									{ value: hlp.getUser('providerUser').email }
								],
								_raw: '(not mocked)', _json: { not: 'mocked ' }
							}
						}).end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							hlp.release.createRelease4('providerUser', request, function(r) {
								releases.push(r);
								done();
							});
						});
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

		it('should fail when listing moderation fields as anonymous', function(done) {
			request
				.get('/api/v1/releases')
				.query({ fields: 'moderation' })
				.end(hlp.status(403, 'must be logged in order to fetch moderation fields', done));
		});

		it('should fail when listing moderation fields as non-moderator', function(done) {
			request
				.get('/api/v1/releases')
				.as('member')
				.query({ fields: 'moderation' })
				.end(hlp.status(403, 'must be moderator in order to fetch moderation fields', done));
		});

		it('should list moderation fields as moderator', function(done) {
			request
				.get('/api/v1/releases')
				.as('moderator')
				.query({ fields: 'moderation' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body[0].moderation).to.be.ok();
					done();
				});
		});

		it('should return the nearest thumb match of widescreen/night', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					const rls1 = _.find(res.body, { id: releases[0].id });
					const rls2 = _.find(res.body, { id: releases[1].id });
					const rls3 = _.find(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].playfield_image.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.url);

					done();
				});
		});

		it('should return the nearest thumb match of widescreen/night in the correct format', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=orientation:ws,lighting:night&thumb_format=medium')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					const rls1 = _.find(res.body, { id: releases[0].id });
					const rls2 = _.find(res.body, { id: releases[1].id });
					const rls3 = _.find(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.variations.medium.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[1].playfield_image.variations.medium.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.variations.medium.url);

					done();
				});
		});

		it('should return the nearest thumb match of night/widescreen', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					const rls1 = _.find(res.body, { id: releases[0].id });
					const rls2 = _.find(res.body, { id: releases[1].id });
					const rls3 = _.find(res.body, { id: releases[2].id });

					expect(rls1.thumb.image.url).to.be(releases[0].versions[0].files[0].playfield_image.url);
					expect(rls2.thumb.image.url).to.be(releases[1].versions[0].files[0].playfield_image.url);
					expect(rls3.thumb.image.url).to.be(releases[2].versions[0].files[1].playfield_image.url);

					done();
				});
		});

		it('should return the a thumb of an older version if the newer version has no such thumb', function(done) {
			request
				.get('/api/v1/releases?thumb_full_data&thumb_flavor=lighting:night,orientation:ws')
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					const rls4 = _.find(res.body, { id: releases[3].id });
					expect(rls4.thumb.image.url).to.be(releases[3].versions[1].files[0].playfield_image.url);

					done();
				});
		});

		it('should return square thumb format', function(done) {
			request
				.get('/api/v1/releases?thumb_format=square')
				.save({ path: 'releases/list'})
				.end(function(err, res) {

					hlp.expectStatus(err, res, 200);

					for (let i = 0; i < numReleases; i++) {
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
			const ids = [releases[0].id, releases[1].id];
			request.get('/api/v1/releases?ids=' + ids.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(res.body).to.have.length(ids.length);
				expect(_.find(res.body, { id: releases[0].id })).to.be.ok();
				expect(_.find(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only tagged releases', function(done) {

			const tags = ['dof'];

			request.get('/api/v1/releases?tags=' + tags.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				const tagFilter = tags.map(function(tag) {
					return { id: tag };
				});
				const taggedReleases = _.filter(releases, { tags: tagFilter });
				expect(res.body).to.have.length(taggedReleases.length);
				for (let i = 0; i < taggedReleases.length; i++) {
					expect(_.find(res.body, { id: taggedReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only tagged releases for multiple tags', function(done) {

			const tags = ['dof', 'wip'];

			request.get('/api/v1/releases?tags=' + tags.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				const tagFilter = tags.map(function(tag) {
					return { id: tag };
				});
				const taggedReleases = _.filter(releases, { tags: tagFilter });
				expect(res.body).to.have.length(taggedReleases.length);
				for (let i = 0; i < taggedReleases.length; i++) {
					expect(_.find(res.body, { id: taggedReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only releases whose name matches a query', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].name).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.find(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only releases whose game title matches a query', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].game.title).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.find(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should fail for queries less than 3 characters', function(done) {
			request.get('/api/v1/releases?q=12').end(hlp.status(400, done));
		});

		it('should succeed for queries more than 2 character', function(done) {

			request.get('/api/v1/releases?q=' + releases[1].name.substr(0, 3)).end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.find(res.body, { id: releases[1].id })).to.be.ok();
				done();
			});
		});

		it('should list only a given flavor', function(done) {

			request.get('/api/v1/releases?flavor=orientation:ws').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(_.find(res.body, { id: releases[0].id })).to.not.be.ok();
				expect(_.find(res.body, { id: releases[1].id })).to.be.ok();
				expect(_.find(res.body, { id: releases[2].id })).to.be.ok();
				done();
			});
		});

		it('should list only releases for a given build', function(done) {

			const builds = ['10.x'];
			request.get('/api/v1/releases?builds=' + builds.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				let filteredReleases = [];
				_.each(builds, function(build) {
					filteredReleases = filteredReleases.concat(_.filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
				});
				expect(res.body).to.have.length(filteredReleases.length);
				for (let i = 0; i < filteredReleases.length; i++) {
					expect(_.find(res.body, { id: filteredReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should list only releases for multiple builds', function(done) {

			const builds = ['10.x', 'physmod5'];
			request.get('/api/v1/releases?builds=' + builds.join(',')).end(function(err, res) {
				hlp.expectStatus(err, res, 200);

				let filteredReleases = [];
				_.each(builds, function(build) {
					filteredReleases = filteredReleases.concat(_.filter(releases, { versions: [{ files: [{ compatibility: [{ id: build }] }]}]}));
				});
				expect(res.body).to.have.length(filteredReleases.length);
				for (let i = 0; i < filteredReleases.length; i++) {
					expect(_.find(res.body, { id: filteredReleases[i].id })).to.be.ok();
				}
				done();
			});
		});

		it('should contain a thumb field per file if requested', function(done) {
			request.get('/api/v1/releases?thumb_format=square&thumb_per_file=true').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				for (let i = 0; i < res.body.length; i++) {
					expect(res.body[i].versions[0].files[0].thumb).to.be.an('object');
					expect(res.body[i].versions[0].files[0].thumb.url).to.contain('/square/');
				}
				done();
			});
		});

		it('should refuse thumb field per file if no format is given', function(done) {
			request.get('/api/v1/releases?thumb_per_file=true').end(hlp.status(400, 'must specify "thumb_format"', done));
		});

		it('should fail when filtering by provider without provider token', function(done) {
			request
				.get('/api/v1/releases')
				.query({ provider_user: '1234' })
				.end(hlp.status(400, 'Must be authenticated with provider token', done));
		});

		it('should succeed filtering by user provider id', function(done) {
			request
				.post('/api/v1/tokens')
				.as('admin')
				.send({ label: 'Test Application', password: hlp.getUser('admin').password, provider: 'github', type: 'provider', scopes: [ 'community'] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					const token = res.body.token;
					request
						.get('/api/v1/releases')
						.with(token)
						.query({ provider_user: '11234' })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.length).to.be(1);
							expect(res.body[0].id).to.be(releases[3].id);
							done();
						});
				});
		});

		it('should only list releases with table files of a given size');
		it('should only list releases with table files of a given size and threshold');

	});

});