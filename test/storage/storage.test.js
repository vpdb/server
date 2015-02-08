"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The storage engine of VPDB', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when providing cache information', function() {

		it('should return a "Last-Modified" header for all storage items.', function(done) {

			hlp.file.createBackglass('member', request, function(backglass) {
				hlp.doomFile('member', backglass.id);
				hlp.storageToken(request, 'member', backglass.url, function(token) {
					request
						.get(backglass.url)
						.query({ token: token })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.headers['last-modified']).not.to.be.empty();
							done();
						});
				});
			});
		});

		it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', function(done) {

			hlp.file.createBackglass('member', request, function(backglass) {
				hlp.doomFile('member', backglass.id);
				hlp.storageToken(request, 'member', backglass.url, function(token) {
					request
						.get(backglass.url)
						.query({ token: token })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							var lastModified = res.headers['last-modified'];
							request
								.get(backglass.url)
								.query({ token: token })
								.set('If-Modified-Since', lastModified)
								.end(function(err, res) {
									hlp.expectStatus(err, res, 304);
									expect(res.body).to.be.empty();
									done();
								});
						});
				});
			});
		});

	});

	describe('after successfully uploading a public file', function() {

		describe('when the file is still inactive', function() {

			it('should be able to retrieve the file as the owner', function(done) {
				var text = "should be able to retrieve the file";
				request
					.post('/storage/v1/files')
					.query({ type: 'mooh' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send(text)
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request
							.get(res.body.url)
							.as('member')
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.text).to.be(text);
								done();
							});
					});
			});

			it('should fail with HTTP 403 when trying to retrieve the file as a different user', function(done) {
				request
					.post('/storage/v1/files')
					.query({ type: 'mooh' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send('should fail when trying to retrieve the file as a different user')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request.get(res.body.url).as('anothermember').end(hlp.status(403, done));
					});
			});

			it('should fail with HTTP 401 when trying to retrieve the file as a anonymous', function(done) {
				request
					.post('/storage/v1/files')
					.query({ type: 'mooh' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send('should fail when trying to retrieve the file as a different user')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request.get(res.body.url).end(hlp.status(401, done));
					});
			});

			it('should block until the file is finished processing when requesting the variation', function(done) {

				hlp.file.createBackglass('member', request, function(backglass) {
					hlp.doomFile('member', backglass.id);
					request.get(backglass.variations['small-2x'].url).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should only return the header when requesting a HEAD on the storage URL', function(done) {

				hlp.file.createTextfile('member', request, function(textfile) {
					request.head(textfile.url).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('member', textfile.id);
						expect(res.headers['content-length']).to.be('0');
						expect(res.text).to.not.be.ok();
						done();
					});
				});
			});

			it('should block until the file is finished processing when requesting the HEAD of a variation', function(done) {

				hlp.file.createBackglass('member', request, function(backglass) {
					hlp.doomFile('member', backglass.id);
					request.head(backglass.variations['small-2x'].url).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be('0');
						expect(res.text).to.not.be.ok();
						done();
					});
				});
			});

		});

		describe('when the file is active', function() {

			it('should block until the file is finished processing when requesting the variation', function(done) {

				hlp.game.createGame('contributor', request, function(game) {
					request.get(game.media.backglass.variations['small-2x'].url).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should grant access to anonymous users', function(done) {

				hlp.game.createGame('contributor', request, function(game) {
					request.get(game.media.backglass.url).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should grant access to logged users', function(done) {

				hlp.game.createGame('contributor', request, function(game) {
					request.get(game.media.backglass.url).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

		});
	});

	describe('after successfully uploading a non-public file', function() {

		describe('when the file is still inactive', function() {

			it('should block a video variation until processing is finished', function(done) {
				hlp.file.createMp4('contributor', request, function(video) {
					request.get(video.variations['small-rotated'].url).as('contributor').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('contributor', video.id);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should block a video variation with a different MIME type until processing is finished', function(done) {
				hlp.file.createAvi('contributor', request, function(video) {
					request.get(video.variations['small-rotated'].url).as('contributor').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('contributor', video.id);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should block HEAD of a video variation with a different MIME type until processing is finished', function(done) {
				hlp.file.createAvi('contributor', request, function(video) {
					request.head(video.variations['small-rotated'].url).as('contributor').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('contributor', video.id);
						expect(res.headers['content-length']).to.be('0');
						expect(res.text).to.not.be.ok();
						done();
					});
				});
			});

		});

		describe('when the file is active', function() {

			it('should deny access to anonymous users');

		});

		describe('when the file has a quota applied', function() {

			it('should contain the X-RateLimit- "Limit", "Remaining" and "Reset" headers');

			it('should grant access to the user if enough quota is available');

			it('should deny access to the user if no more quota is available');

			it('should ignore the quota if the user is the owner of the file');

		});

	});

});
