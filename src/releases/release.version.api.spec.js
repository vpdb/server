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
const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe.skip('The VPDB `Release Version` API', function() {

	describe('when adding a new version to an existing release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				member2: { roles: [ 'member' ] },
				othermember: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
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
					.end(hlp.status(403, 'only moderators or authors of the release', done));
			});
		});

		it('should fail validations when providing valid file reference with invalid meta data', function(done) {

			const user = 'member';
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
							hlp.expectValidationError(err, res, 'files.0._playfield_image', 'must be provided');
							done();
						});
				});
			});
		});

		it('should fail when adding an existing version', function(done) {
			const user = 'member';
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
							_playfield_image: '67890',
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
			const user = 'member';
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
									_playfield_image: playfield.id,
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lighting: 'night' }
								} ]
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 201);
							const version = res.body;
							expect(version).to.be.ok();
								expect(version.changes).to.be('*Second release.*');
								done();
							});
					});
				});
			});
		});

		it('should succeed when logged as non-creator but author', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				let originalAuthors = release.authors.map(a => { return { _user: a.user.id, roles: a.roles };});
				request
					.patch('/api/v1/releases/' + release.id)
					.as(user)
					.send({ authors: [ ...originalAuthors, { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.file.createVpt('othermember', request, function(vptfile) {
							hlp.file.createPlayfield('othermember', request, 'fs', function (playfield) {
								request
									.post('/api/v1/releases/' + release.id + '/versions')
									.as('othermember')
									.send({
										version: '2.0.0',
										changes: '*Second release.*',
										files: [ {
											_file: vptfile.id,
											_playfield_image: playfield.id,
											_compatibility: [ '9.9.0' ],
											flavor: { orientation: 'fs', lighting: 'night' }
										} ]
									}).end(function(err, res) {
										hlp.expectStatus(err, res, 201);
									const version = res.body;
									expect(version).to.be.ok();
										expect(version.changes).to.be('*Second release.*');
										done();
									});
							});
					});

				});
			});
		});

		it('should succeed when logged as non-creator but moderator', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function (playfield) {
						request
							.post('/api/v1/releases/' + release.id + '/versions')
							.as('moderator')
							.send({
								version: '2.0.0',
								changes: '*Second release.*',
								files: [ {
									_file: vptfile.id,
									_playfield_image: playfield.id,
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lighting: 'night' }
								} ]
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 201);
							const version = res.body;
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
				othermember: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when logged as a different user', function(done) {
			hlp.release.createRelease('member', request, function(release) {
				request.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
					.as('member2')
					.send({})
					.saveResponse({ path: 'releases/update-version'})
					.end(hlp.status(403, 'only moderators and authors of the release', done));
			});
		});

		it('should fail for duplicate compat/flavor', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				const versionFile = release.versions[0].files[0];
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
						const data = {
							files: [{
								_file: vptfile.id,
								_playfield_image: playfield.id,
								_compatibility: _.map(versionFile.compatibility, 'id'),
								flavor: versionFile.flavor
							}]
						};
						request
							.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
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
			const user = 'member';
			const newChanges = 'New changes.';
			hlp.release.createRelease(user, request, function(release) {
				hlp.file.createVpt(user, request, function(vptfile) {
					hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
						request
							.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
							.save({ path: 'releases/update-version'})
							.as(user)
							.send({
								changes: newChanges,
								files: [{
									_file: vptfile.id,
									_playfield_image: playfield.id,
									_compatibility: ['9.9.0'],
									flavor: { orientation: 'fs', lighting: 'day' }
								}]
							}).end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.changes).to.be(newChanges);
								done();
							});
					});
				});
			});
		});

		it('should fail when data is missing', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				hlp.file.createVpt(user, request, function(vptfile) {
					request
						.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
						.as(user)
						.send({
							files: [{
								_file: vptfile.id,
								flavor: {},
								_compatibility: [],
								_playfield_image: null,
								_playfield_video: null
							}]
						}).end(function(err, res) {
							hlp.expectValidationError(err, res, 'files.0._compatibility', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0._playfield_image', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0.flavor.lighting', 'must be provided');
							hlp.expectValidationError(err, res, 'files.0.flavor.orientation', 'must be provided');
							done();
						});
				});
			});
		});

		it('should succeed when rotating an existing playfield image', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				let playfieldImage = release.versions[0].files[0].playfield_image;
				request
					.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
					.query({ rotate: release.versions[0].files[0].playfield_image.id + ':90' })
					.as(user)
					.send({
						files: [{
							_file: release.versions[0].files[0].file.id,
							flavor: { orientation: 'any', lighting: 'day' }
						}]
					}).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						let rotatedPlayfieldImage = res.body.files[0].playfield_image;
						expect(playfieldImage.metadata.size.height).to.be(rotatedPlayfieldImage.metadata.size.width);
						expect(playfieldImage.metadata.size.width).to.be(rotatedPlayfieldImage.metadata.size.height);
						done();
				});
			});
		});

		it('should fail when rotating not a playfield image', function(done) {
			const user = 'member';
			hlp.release.createRelease(user, request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
					.query({ rotate: release.versions[0].files[0].file.id + ':90' })
					.as(user)
					.send({
						files: [{
							_file: release.versions[0].files[0].file.id,
							flavor: { orientation: 'ws' }
						}]
					}).end(hlp.status(400, 'can only rotate images', done));
			});
		});

		it('should fail when rotating playfield that does not belong to the version', function(done) {
			let user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', 'playfield', function(playfield) {
				hlp.release.createRelease(user, request, function(release) {
					request
						.patch('/api/v1/releases/' + release.id  + '/versions/' + release.versions[0].version)
						.query({ rotate: playfield.id + ':90' })
						.as('member')
						.send({ })
						.end(hlp.status(400, 'it is not part of the release', done));
				});
			});
		});

		it('should succeed when logged as non-creator but author', function(done) {
			const user = 'member';
			const newChanges = 'New changes.';
			hlp.release.createRelease(user, request, function(release) {
				let originalAuthors = release.authors.map(a => { return { _user: a.user.id, roles: a.roles };});
				request
					.patch('/api/v1/releases/' + release.id)
					.as(user)
					.send({ authors: [ ...originalAuthors, { _user: hlp.getUser('othermember').id, roles: [ 'Some other job' ] } ] })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						request
							.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
							.as('othermember')
							.send({ changes: newChanges})
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								const version = res.body;
								expect(version).to.be.ok();
								expect(version.changes).to.be(newChanges);
								done();
							});
					});
			});
		});

		it('should succeed when logged as non-creator but moderator', function(done) {
			const user = 'member';
			const newChanges = 'New changes.';
			hlp.release.createRelease(user, request, function(release) {
				request
					.patch('/api/v1/releases/' + release.id + '/versions/' + release.versions[0].version)
					.as('moderator')
					.send({ changes: newChanges})
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						const version = res.body;
						expect(version).to.be.ok();
						expect(version.changes).to.be(newChanges);
						done();
					});
			});
		});

	});

});