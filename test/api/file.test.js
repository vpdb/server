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

	var backglass = path.resolve(__dirname, '../../data/test/files/backglass_half_blank.png');

	var fileIds = { member: [] };

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanupFiles(request, fileIds, function() {
			hlp.teardownUsers(request, done);
		});
	});

	describe('before trying to upload a file', function() {

		it('should fail when no "Content-Disposition" header is provided', function(done) {
			request
				.post('/api/files')
				.as('member')
				.send('xxx')
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(422);
					expect(res.body.error).to.contain('Content-Disposition');
					done();
				});
		});

		it('should fail when a bogus "Content-Disposition" header is provided', function(done) {
			request
				.post('/api/files')
				.as('member')
				.set('Content-Disposition', 'zurg!!')
				.send('xxx')
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(422);
					expect(res.body.error).to.contain('Content-Disposition');
					done();
				});
		});

		it('should fail when no "type" query parameter is provided', function(done) {
			request
				.post('/api/files')
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
				.post('/api/files')
				.query({ type: 'foo' })
				.as('member')
				.set('Content-Disposition','attachment; filename="foo.bar"')
				.send('xxx')
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(422);
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
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
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
			var data = fs.readFileSync(backglass);
			var fileType = 'backglass';
			var mimeType = 'image/png';
			var name = 'backglass.png';

			request
				.post('/api/files')
				.query({ type: fileType })
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.set('Content-Length', data.length)
				.send(data)
				.as('member')
				.end(function(res) {
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.id).to.be.ok();
					expect(res.body.metadata.size.width).to.be(640);
					expect(res.body.metadata.size.height).to.be(512);
					expect(res.body.variations.small).to.be.an('object');
					expect(res.body.variations.medium).to.be.an('object');
					done();
				});
		});

		it('should fail if the upload is not an png image', function(done) {
			var data = 'not an image!';
			var fileType = 'backglass';
			var mimeType = 'image/png';
			var name = 'backglass.png';

			request
				.post('/api/files')
				.query({ type: fileType })
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.set('Content-Length', data.length)
				.send(data)
				.as('member')
				.end(function(res) {
					expect(res.status).to.be(400);
					expect(res.body.error).to.contain('corrupted');
					done();
				});
		});

		it('should fail if the upload is not a jpeg image', function(done) {

			var data = 'not an image!';
			var fileType = 'backglass';
			var mimeType = 'image/jpeg';
			var name = 'backglass.jpg';

			request
				.post('/api/files')
				.query({ type: fileType })
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.set('Content-Length', data.length)
				.send(data)
				.as('member')
				.end(function(res) {
					expect(res.status).to.be(400);
					expect(res.body.error).to.contain('corrupted');
					done();
				});
		});
	});

	describe('after successfully uploading a file', function() {

		it('should be able to retrieve the file', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get(res.body.url)
						.as('member')
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(200);
							expect(res.text).to.be(text);
							done();
						});
				});
		});

		it('should be able to retrieve the file details', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get('/api/files/' + res.body.id)
						.as('member')
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(200);
							expect(res.body.file_type).to.be(fileType);
							done();
						});
				});
		});

		it('should fail to retrieve the file details as anonymous', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get('/api/files/' + res.body.id)
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(401);
							expect(res.body.error).to.contain('is inactive');
							done();
						});
				});
		});

		it('should fail to retrieve the file details as a different user', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get('/api/files/' + res.body.id)
						.as('anothermember')
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(403);
							expect(res.body.error).to.contain('is inactive');
							done();
						});
				});
		});

		it('should fail when trying to retrieve the file as a different user', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get(res.body.url)
						.as('anothermember')
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(403);
							done();
						});
				});
		});

		it('should fail when trying to retrieve the file as anonymous', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = 'text.txt';
			var text = "I'm the content of a test text file.";
			request
				.post('/api/files')
				.query({ type: fileType })
				.as('member')
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.send(text)
				.end(function(err, res) {
					expect(err).to.eql(null);
					expect(res.status).to.be(201);
					fileIds.member.push(res.body.id);
					expect(res.body.url).to.be.ok();
					request
						.get(res.body.url)
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(401);
							done();
						});
				});
		});

	});

	describe('when deleting a file', function() {

		it('should succeed as owner of the file', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			var id, url;
			async.series([
				// 1. upload
				function(next) {
					request
						.post('/api/files')
						.query({ type: fileType })
						.as('member')
						.type(mimeType)
						.set('Content-Disposition', 'attachment; filename="' + name + '"')
						.send(text)
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(201);
							expect(res.body.url).to.be.ok();
							id = res.body.id;
							url = res.body.url;
							next();
						});
				},
				// 2. check it's there
				function(next) {
					request.get(url).as('member').end(hlp.status(200, next));
				},
				// 3. delete
				function(next) {
					request.del('/api/files/' + id).as('member').end(hlp.status(204, next));
				},
				// 4. check it's not there
				function(next) {
					request.get(url).as('member').end(hlp.status(404, next));
				}
			], done);
		});

		it('should fail if not owner of the file', function(done) {
			var fileType = 'mooh';
			var mimeType = 'text/plain';
			var name = "text.txt";
			var text = "I'm the content of a test text file.";
			var id, url;
			async.series([
				// 1. upload
				function(next) {
					request
						.post('/api/files')
						.query({ type: fileType })
						.as('member')
						.type(mimeType)
						.set('Content-Disposition', 'attachment; filename="' + name + '"')
						.send(text)
						.end(function(err, res) {
							expect(err).to.eql(null);
							expect(res.status).to.be(201);
							expect(res.body.url).to.be.ok();
							id = res.body.id;
							url = res.body.url;
							next();
						});
				},
				function(next) {
					request.del('/api/files/' + id).as('anothermember').end(hlp.status(403, next));
				}
			], done);
		});

	});

});