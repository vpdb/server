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
			anothermember: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when providing cache information', function() {

		it('should return a "Last-Modified" header for all storage items.', function(done) {

			hlp.file.createBackglass('member', request, function(backglass) {
				request
					.get(backglass.url)
					.query({ jwt: request.tokens.member })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('member', backglass.id);

						expect(res.headers['last-modified']).not.to.be.empty();
						done();
					});
			});
		});

		it('should return a HTTP 304 Not Modified if a file is requested with the "If-Modified-Since" header', function(done) {

			hlp.file.createBackglass('member', request, function(backglass) {
				request
					.get(backglass.url)
					.query({ jwt: request.tokens.member })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						hlp.doomFile('member', backglass.id);

						var lastModified = res.headers['last-modified'];
						request
							.get(backglass.url)
							.query({ jwt: request.tokens.member })
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

	describe('after successfully uploading a public file', function() {

		describe('when the file is still inactive', function() {

			it('should be able to retrieve the file as the owner', function(done) {
				var text = "should be able to retrieve the file";
				request
					.post('/storage')
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
					.post('/storage')
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
					.post('/storage')
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

			it('should block until the file is finished processing when requesting the variation');
		});

		describe('when the file is active', function() {

			it('should block until the file is finished processing when requesting the variation');

			it('should grant access to anonymous users');

			it('should grant access to logged users');

		});
	});


	describe('after successfully uploading a non-public file', function() {

		describe('when the file is active', function() {

			it('should deny access to anonymous users');

		});

		describe('when the file has a quota applied', function() {

			it('should grant access to the user if enough quota is available');

			it('should deny access to the user if no more quota is available');

			it('should ignore the quota if the user is the owner of the file');

		});

	});

});
