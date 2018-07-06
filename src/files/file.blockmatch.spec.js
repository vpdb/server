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

"use strict"; /*global describe, before, after, it*/

const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe('The VPDB `blockmatch` API', function() {

	describe('when trying to match a file', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ 'moderator' ]},
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail if the file does not exist', function(done) {
			request.get('/api/v1/files/züürglz/blockmatch').as('moderator').end(hlp.status(404, done));
		});

		it('should fail if the file is not a table file', function(done) {
			hlp.file.createBackglass('moderator', request, function(bg) {
				request.get('/api/v1/files/' + bg.id + '/blockmatch').as('moderator').end(hlp.status(400, 'can only match table files', done));
			});
		});

		it('should fail if the file is not linked to a release', function(done) {
			hlp.file.createVpt('moderator', request, function(vpt) {
				request.get('/api/v1/files/' + vpt.id + '/blockmatch').as('moderator').end(hlp.status(400, 'release reference missing', done));
			});
		});

		it('should match the file from a different release', function(done) {

			hlp.release.createRelease('moderator', request, function(release1) {
				hlp.release.createRelease('moderator', request, { alternateVpt: true }, function(release2) {
					request
						.get('/api/v1/files/' + release1.versions[0].files[0].file.id + '/blockmatch')
						.as('moderator')
						.save({ path: 'files/blockmatch'})
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							// file to be matched
							expect(res.body.game.id).to.be(release1.game.id);
							expect(res.body.version.version).to.be(release1.versions[0].version);
							expect(res.body.file.file.id).to.be(release1.versions[0].files[0].file.id);

							// matches
							expect(res.body.matches).to.have.length(1);
							expect(res.body.matches[0].game.id).to.be(release2.game.id);
							expect(res.body.matches[0].version.version).to.be(release2.versions[0].version);
							expect(res.body.matches[0].file.file.id).to.be(release2.versions[0].files[0].file.id);

							done();
						});
				});
			});
		});
	});

	describe('when trying to match a file from the same release', function() {

		let release;
		const version = '2.0';
		let file;

		before(function(done) {
			hlp.setupUsers(request, {
				moderator: { roles: [ 'moderator' ]},
			}, function() {
				hlp.release.createRelease('moderator', request, function(r) {
					release = r;
					hlp.file.createVpt('moderator', request, { alternateVpt: true }, function(vpt) {
						file = vpt;
						hlp.file.createPlayfield('moderator', request, 'ws', function(pf) {
							request
								.post('/api/v1/releases/' + release.id + '/versions', {
									version: version,
									files: [ {
										_file: vpt.id,
										_playfield_image: pf.id,
										_compatibility: [ "9.9.0" ],
										flavor: { "orientation": "ws", "lighting": "night" }
									} ]
								})
								.as('moderator')
								.end(function(err, res) {
									hlp.expectStatus(err, res, 201);
									done();
								});
						});
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should not match a file', function(done) {
			request
				.get('/api/v1/files/' + release.versions[0].files[0].file.id + '/blockmatch')
				.as('moderator')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					// file to be matched
					expect(res.body.game.id).to.be(release.game.id);
					expect(res.body.version.version).to.be(release.versions[0].version);
					expect(res.body.file.file.id).to.be(release.versions[0].files[0].file.id);

					// matches
					expect(res.body.matches).to.be.empty();
					done();
				});
		});

		it('should match the file when specified', function(done) {
			request
				.get('/api/v1/files/' + release.versions[0].files[0].file.id + '/blockmatch')
				.as('moderator')
				.query({ include_same_release: true })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					// file to be matched
					expect(res.body.matches).to.have.length(1);
					expect(res.body.game.id).to.be(release.game.id);
					expect(res.body.version.version).to.be(release.versions[0].version);
					expect(res.body.file.file.id).to.be(release.versions[0].files[0].file.id);

					// matches
					expect(res.body.matches[0].game.id).to.be(release.game.id);
					expect(res.body.matches[0].version.version).to.be('2.0');
					expect(res.body.matches[0].file.file.id).to.be(file.id);

					done();
				});
		});
	});
});

