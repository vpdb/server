"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');
var async = require('async');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The storage engine of VPDB', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			moderator: { roles: [ 'moderator' ]},
			contributor: { roles: [ 'contributor' ]},
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	// describe('when providing cache information', function() {
	//
	// 	it('should return a "Last-Modified" header for all storage items.', function(done) {
	//
	// 		hlp.file.createBackglass('member', request, function(backglass) {
	// 			hlp.doomFile('member', backglass.id);
	// 			hlp.storageToken(request, 'member', backglass.url, function(token) {
	// 				request
	// 					.get(hlp.urlPath(backglass.url))
	// 					.query({ token: token })
	// 					.end(function(err, res) {
	// 						hlp.expectStatus(err, res, 200);
	// 						expect(res.headers['last-modified']).not.to.be.empty();
	// 						done();
	// 					});
	// 			});
	// 		});
	// 	});
	//
	// 	it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', function(done) {
	//
	// 		hlp.file.createBackglass('member', request, function(backglass) {
	// 			hlp.doomFile('member', backglass.id);
	// 			hlp.storageToken(request, 'member', backglass.url, function(token) {
	// 				request
	// 					.get(hlp.urlPath(backglass.url))
	// 					.query({ token: token })
	// 					.end(function(err, res) {
	// 						hlp.expectStatus(err, res, 200);
	//
	// 						var lastModified = res.headers['last-modified'];
	// 						request
	// 							.get(hlp.urlPath(backglass.url))
	// 							.query({ token: token })
	// 							.set('If-Modified-Since', lastModified)
	// 							.end(function(err, res) {
	// 								hlp.expectStatus(err, res, 304);
	// 								expect(res.body).to.be.empty();
	// 								done();
	// 							});
	// 					});
	// 			});
	// 		});
	// 	});
	//
	// });

	describe('after successfully uploading a public file', function() {

		describe('when the file is still inactive', function() {

			it('should be able to retrieve the file as the owner', function(done) {
				var text = "should be able to retrieve the file";
				request
					.post('/storage/v1/files')
					.query({ type: 'release' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send(text)
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request
							.get(hlp.urlPath(res.body.url))
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
					.query({ type: 'release' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send('should fail when trying to retrieve the file as a different user')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request.get(hlp.urlPath(res.body.url)).as('anothermember').end(hlp.status(403, done));
					});
			});

			it('should fail with HTTP 401 when trying to retrieve the file as a anonymous', function(done) {
				request
					.post('/storage/v1/files')
					.query({ type: 'release' })
					.as('member')
					.type('text/plain')
					.set('Content-Disposition', 'attachment; filename="text.txt"')
					.send('should fail when trying to retrieve the file as a different user')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomFile('member', res.body.id);
						expect(res.body.url).to.be.ok();
						request.get(hlp.urlPath(res.body.url)).end(hlp.status(401, done));
					});
			});

			it('should block until the file is finished processing when requesting the variation', function(done) {

				hlp.file.createBackglass('member', request, function(backglass) {
					hlp.doomFile('member', backglass.id);
					request.get(hlp.urlPath(backglass.variations['small-2x'].url)).as('member').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should only return the header when requesting a HEAD on the storage URL', function(done) {

				hlp.file.createTextfile('member', request, function(textfile) {
					request.head(hlp.urlPath(textfile.url)).as('member').end(function(err, res) {
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
					request.head(hlp.urlPath(backglass.variations['small-2x'].url)).as('member').end(function(err, res) {
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

				hlp.game.createGame('moderator', request, function(game) {
					request.get(hlp.urlPath(game.backglass.variations['small-2x'].url)).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should grant access to anonymous users', function(done) {

				hlp.game.createGame('moderator', request, function(game) {
					request.get(hlp.urlPath(game.backglass.variations.small.url)).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should grant access to logged users', function(done) {

				hlp.game.createGame('moderator', request, function(game) {
					request.get(hlp.urlPath(game.backglass.url)).as('member').end(function(err, res) {
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
				hlp.file.createMp4('moderator', request, function(video) {

					// now spawn 5 clients that try to retrieve this simultaneously
					async.times(5, function(n, next){
						request.get(hlp.urlPath(video.variations['small-rotated'].url)).as('moderator').end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.headers['content-length']).to.be.greaterThan(0);
							next();
						});
					}, function() {
						hlp.doomFile('moderator', video.id);
						done();
					});
				});
			});

			it('should block a video variation with a different MIME type until processing is finished', function(done) {
				hlp.file.createAvi('moderator', request, function(video) {
					request.get(hlp.urlPath(video.variations['small-rotated'].url)).as('moderator').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('moderator', video.id);
						expect(res.headers['content-length']).to.be.greaterThan(0);
						done();
					});
				});
			});

			it('should block HEAD of a video variation with a different MIME type until processing is finished', function(done) {
				hlp.file.createAvi('moderator', request, function(video) {
					request.head(hlp.urlPath(video.variations['small-rotated'].url)).as('moderator').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('moderator', video.id);
						expect(res.headers['content-length']).to.be('0');
						expect(res.text).to.not.be.ok();
						done();
					});
				});
			});

		});

		describe('when the file is active', function() {

			it('should deny access to anonymous users', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request.get(hlp.urlPath(fileUrl)).end(hlp.status(401, done, 'valid credentials'));
				});
			});

			it('should grant access to an authenticated user', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request.get(hlp.urlPath(fileUrl)).as('contributor').end(hlp.status(200, done));
				});
			});

			it('should grant access using a storage token', function(done) {
				hlp.release.createRelease('member', request, function(release) {
					var fileUrl = release.versions[0].files[0].file.url;
					request
						.post('/storage/v1/authenticate')
						.as('contributor')
						.save({ path: 'auth/storage' })
						.send({ paths: fileUrl })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body).to.be.an('object');
							expect(res.body).to.have.key(fileUrl);
							request.get(hlp.urlPath(fileUrl)).query({ token: res.body[fileUrl] }).end(hlp.status(200, done));
						});
				});
			});

		});

		describe('when the file has a quota applied', function() {

			it('should contain the X-RateLimit- "Limit", "Remaining" and "Reset" headers');

			it('should grant access to the user if enough quota is available');

			it('should deny access to the user if no more quota is available');

			it('should ignore the quota if the user is the owner of the file');

		});

	});

});
