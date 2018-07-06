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

const async = require('async');
const request = require('superagent');
const expect = require('expect.js');

const superagentTest = require('../../test/modules/superagent-test');
const hlp = require('../../test/modules/helper');

superagentTest(request);

describe.skip('The VPDB `Release` storage API', function() {

	describe('when downloading a release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				countertest: { roles: [ 'member' ] },
				moderator: { roles: [ 'moderator' ] },
				contributor: { roles: [ 'contributor' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should update all the necessary download counters.', function(done) {

			hlp.release.createRelease('contributor', request, function(release) {
				const url = '/storage/v1/releases/' + release.id;
				const body = {
					files: [release.versions[0].files[0].file.id],
					media: {
						playfield_image: false,
						playfield_video: false
					},
					game_media: false
				};
				hlp.storageToken(request, 'countertest', url, function(token) {
					request.get(hlp.urlPath(url)).query({ token: token, body: JSON.stringify(body) }).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						const tests = [];

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

});