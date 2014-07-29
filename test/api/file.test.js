"use strict"; /*global describe, before, after, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `file` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ]},
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
		// also clean all files
	});

	it('should fail when no "Content-Disposition" header is provided', function(done) {
		request
			.put('/api/files')
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
			.put('/api/files')
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
			.put('/api/files?type=foo')
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
			.put('/api/files?type=' + fileType)
			.as('member')
			.set('Content-Type', mimeType)
			.set('Content-Disposition', 'attachment; filename="' + name + '"')
			.send(text)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.be(200);
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
			.put('/api/files?type=' + fileType)
			.as('member')
			.set('Content-Type', mimeType)
			.set('Content-Disposition', 'attachment; filename="' + name + '"')
			.send(text)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.be(200);
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
			.put('/api/files?type=' + fileType)
			.as('member')
			.set('Content-Type', mimeType)
			.set('Content-Disposition', 'attachment; filename="' + name + '"')
			.send(text)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.be(200);
				expect(res.body.url).to.be.ok();
				request
					.get(res.body.url)
					.as('anothermember')
					.end(function(err, res) {
						expect(err).to.eql(null);
						expect(res.status).to.be(401);
						done();
					});
			});
	});

	it('should fail retrieving an uploaded text file as anonymous', function(done) {
		var fileType = 'mooh';
		var mimeType = 'text/plain';
		var name = "text.txt";
		var text = "I'm the content of a test text file.";
		request
			.put('/api/files?type=' + fileType)
			.as('member')
			.set('Content-Type', mimeType)
			.set('Content-Disposition', 'attachment; filename="' + name + '"')
			.send(text)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.be(200);
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