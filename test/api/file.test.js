"use strict"; /*global describe, before, after, it*/

var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `file` API', function() {

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

	describe('before trying to upload a file', function() {

		it('should fail when no "Content-Disposition" header is provided', function(done) {
			request
				.post('/storage/v1/files')
				.as('member')
				.send('xxx')
				.end(hlp.status(422, 'Content-Disposition', done));
		});

		it('should fail when a bogus "Content-Disposition" header is provided', function(done) {
			request
				.post('/storage/v1/files')
				.as('member')
				.set('Content-Disposition', 'zurg!!')
				.send('xxx')
				.end(hlp.status(422, 'Content-Disposition', done));
		});

		it('should fail when no "type" query parameter is provided', function(done) {
			request
				.post('/storage/v1/files')
				.as('member')
				.set('Content-Disposition','attachment; filename="foo.bar"')
				.send('xxx')
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(422);
					expect(res.body.error).to.contain('type');
					done();
				});
		});

		it('should fail when providing wrong mime type in header', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'foo' })
				.as('member')
				.set('Content-Disposition','attachment; filename="foo.bar"')
				.send('xxx')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 422);
					expect(res.body.errors).to.be.an('array');
					expect(res.body.errors[0].message).to.contain('Invalid MIME type');
					done();
				});
		});
	});

	describe('when uploading a text file', function() {

		it('should return an object with the same parameters as provided in the headers', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "should return an object with the same parameters as provided in the headers";
			request
				.post('/storage/v1/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile('member', res.body.id);
					expect(res.body.id).to.be.ok();
					expect(res.body.name).to.be(name);
					expect(res.body.bytes).to.be(text.length);
					expect(res.body.mime_type).to.be(mimeType);
					expect(res.body.file_type).to.be(fileType);
					expect(res.body.variations).to.be.empty();
					done();
				});
		});
	});

	describe('when uploading a backglass image', function() {

		it('should return the correct dimensions and variations', function(done) {
			hlp.file.createBackglass('member', request, function(backglass) {
				expect(backglass.id).to.be.ok();
				expect(backglass.metadata.size.width).to.be(640);
				expect(backglass.metadata.size.height).to.be(512);
				expect(backglass.variations.small).to.be.an('object');
				expect(backglass.variations.medium).to.be.an('object');
				hlp.doomFile('member', backglass.id);
				done();
			});
		});

		it('should fail if the upload is not an png image', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'backglass' })
				.type('image/png')
				.set('Content-Disposition', 'attachment; filename="backglass.png"')
				.send('not an image!')
				.as('member')
				.end(hlp.status(400, 'corrupted', done));

		});

		it('should fail if the upload is not a jpeg image', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'backglass' })
				.type('image/jpeg')
				.set('Content-Disposition', 'attachment; filename="backglass.jpg"')
				.send('not an image!')
				.as('member')
				.end(hlp.status(400, 'corrupted', done));
		});

		it('should fail if the aspect ratio too much off');
	});

	describe('when uploading a video', function() {

		it('should return the correct dimensions', function(done) {
			hlp.file.createMp4('contributor', request, function(video) {
				hlp.doomFile('contributor', video.id);
				expect(video.metadata.video.width).to.be(1920);
				expect(video.metadata.video.height).to.be(1080);
				done();
			});
		});
	});

	describe('after successfully uploading a file', function() {

		it('should be able to retrieve the file details', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = 'text.txt';
			request
				.post('/storage/v1/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send('should be able to retrieve the file details')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile('member', res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get('/api/v1/files/' + res.body.id)
						.as('member')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.name).to.be(name);
							expect(res.body.file_type).to.be(fileType);
							expect(res.body.mime_type).to.be(mimeType);
							done();
						});
				});
		});

		it('should contain the links of the variations in the response of the file upload');

		it('should fail to retrieve the file details as anonymous', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'mooh' })
				.as('member')
				.type('text/plain')
				.set('Content-Disposition', 'attachment; filename="text.txt"')
				.send('should fail to retrieve the file details as anonymous')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile('member', res.body.id);
					expect(res.body.url).to.be.ok();
					request.get('/api/v1/files/' + res.body.id).end(hlp.status(401, 'is inactive', done));
				});
		});

		it('should fail to retrieve the file details as a different user', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'mooh' })
				.as('member')
				.type('text/plain')
				.set('Content-Disposition', 'attachment; filename="text.txt"')
				.send('should fail to retrieve the file details as a different user')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile('member', res.body.id);
					expect(res.body.url).to.be.ok();
					request.get('/api/v1/files/' + res.body.id).as('anothermember').end(hlp.status(403, 'is inactive', done));
				});
		});

		it('should fail when trying to retrieve the file as anonymous', function(done) {
			request
				.post('/storage/v1/files')
				.query({ type: 'mooh' })
				.as('member')
				.type('text/plain')
				.set('Content-Disposition', 'attachment; filename="text.txt"')
				.send('should fail when trying to retrieve the file as anonymous')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomFile('member', res.body.id);
					expect(res.body.url).to.be.ok();
					request.get(res.body.url).end(hlp.status(401, done));
				});
		});

	});

	describe('when deleting a file', function() {

		it('should succeed as owner of the file', function(done) {
			var id, url, user = 'member';
			async.series([
				// 1. upload
				function(next) {
					request
						.post('/storage/v1/files')
						.query({ type: 'mooh' })
						.as(user)
						.type('text/plain')
						.set('Content-Disposition', 'attachment; filename="text.txt"')
						.send('should succeed as owner of the file')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 201);
							expect(res.body.url).to.be.ok();
							id = res.body.id;
							url = res.body.url;
							next();
						});
				},
				// 2. check it's there
				function(next) {
					request.get(url).as(user).end(hlp.status(200, next));
				},
				// 3. delete
				function(next) {
					request.del('/api/v1/files/' + id).as(user).end(hlp.status(204, next));
				},
				// 4. check it's not there
				function(next) {
					request.get(url).as(user).end(hlp.status(404, next));
				}
			], done);
		});

		it('should fail if not owner of the file', function(done) {
			var id, url, user = 'member';
			async.series([
				// 1. upload
				function(next) {
					request
						.post('/storage/v1/files')
						.query({ type: 'mooh' })
						.as(user)
						.type('text/plain')
						.set('Content-Disposition', 'attachment; filename="text.txt"')
						.send('should fail if not owner of the file')
						.end(function(err, res) {
							hlp.expectStatus(err, res, 201);
							hlp.doomFile(user, res.body.id);
							expect(res.body.id).to.be.ok();
							expect(res.body.url).to.be.ok();
							id = res.body.id;
							url = res.body.url;
							next();
						});
				},
				function(next) {
					request.del('/api/v1/files/' + id).as('anothermember').end(hlp.status(403, next));
				}
			], done);
		});

		it('should fail if the file is active', function(done) {
			var user = 'contributor';
			hlp.game.createGame(user, request, function(game) {
				request.del('/api/v1/files/' + game.media.backglass.id).as(user).end(hlp.status(400, 'Cannot remove active file', done));
			});
		});

	});
});

