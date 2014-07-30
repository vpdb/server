"use strict"; /*global describe, before, after, it*/

var fs = require('fs');
var path = require('path');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `file` API', function() {

	var backglass = path.resolve(__dirname, '../../data/test/files/backglass.png');

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

	it('should successfully upload a text file', function(done) {
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

	it('should successfully retrieve an uploaded text file', function(done) {
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
						done();
					});
			});
	});

	it('should fail retrieving an uploaded text file as another user', function(done) {
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

	it('should fail retrieving an uploaded text file as anonymous', function(done) {
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

	it('should successfully upload a backglass file', function(done) {
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
				expect(res.body.variations.small).to.be.an('object');
				expect(res.body.variations.medium).to.be.an('object');
				done();
			});
	});

});