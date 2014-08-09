"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The OAuth2 client of VPDB', function() {

	beforeEach(function (done) {
		hlp.setupUsers(request, { member: { roles: [ 'member' ] } }, done);
	});

	afterEach(function (done) {
		hlp.cleanup(request, done);
	});

	describe('when authenticating via GitHub', function() {

		it('should create a new user and inject the authentication token into the HTML element', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'github',
					profile: {
						provider: 'github',
						id: '11234',
						displayName: null,
						username: 'mockuser',
						profileUrl: 'https://github.com/mockuser',
						emails: [
							{ value: 'mockuser@vpdb.ch' }
						],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				}).end(hlp.auth.assertValidToken(request, done));
		});

		it('should match the same already registered Github user even though email and name are different', function(done) {
			var githubId = '65465';
			request
				.post('/auth/mock')
				.send({
					provider: 'github',
					profile: { provider: 'github', id: githubId, displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
						emails: [ { value: 'mockuser@vpdb.ch' } ]
					}
				}).end(hlp.auth.assertValidToken(request, function(err, profile1) {

					request
						.post('/auth/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: githubId, displayName: 'bleh', username: 'foo',
								emails: [ { value: 'other.email@vpdb.ch' } ]
							}
						}).end(hlp.auth.assertValidToken(request, function(err, profile2) {
							expect(profile1.id).to.be(profile2.id);
							done();
						}));
				}));
		});

		it('should match an already registered local user with the same email address', function(done) {
			var localUser = hlp.getUser('member');
			request
				.post('/auth/mock')
				.send({
					provider: 'github',
					profile: { provider: 'github', id: '1234abcd', displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
						emails: [ { value: localUser.email } ]
					}
				}).end(hlp.auth.assertValidToken(request, function(err, profile) {
					expect(profile.id).to.be(localUser.id);
					done();
				}, true));
		});

		it('should change the account type to "local" after setting a password');
	});

	describe('when authenticating via IPB', function() {

		it('should create a new user and inject the authentication token into the HTML element', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: {
						provider: 'ipbtest',
						id: '2',
						username: 'test',
						displayName: 'test i am',
						profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'test@vpdb.ch' } ],
						photos: [ { value: 'http://localhost:8088/uploads/' } ]
					}
				})
				.end(hlp.auth.assertValidToken(request, done));
		});

		it('should match an already registered GitHub user with the same email address', function(done) {
			var email = 'imthesame@vpdb.ch';
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '2', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: email } ]
					}
				}).end(hlp.auth.assertValidToken(request, function(err, profile) {
					var userId = profile.id;
					request
						.post('/auth/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: '1234abcd', displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
								emails: [ { value: email } ]
							}
						}).end(hlp.auth.assertValidToken(request, function(err, profile) {
							expect(profile.id).to.be(userId);
							done();
						}, true));
				}));
		});

		it('should not match an already registered GitHub user even though ID, username and display name are the same', function(done) {
			var id = '23';
			var username = 'doofus';
			var displayname = 'Doof Us';
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: id, username: username, displayName: displayname, profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'email1@vpdb.ch' } ]
					}
				}).end(hlp.auth.assertValidToken(request, function(err, profile) {
					var userId = profile.id;
					request
						.post('/auth/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: id, username: username, displayName: displayname, profileUrl: 'https://github.com/mockuser',
								emails: [ { value: 'email2@vpdb.ch' } ]
							}
						}).end(hlp.auth.assertValidToken(request, function(err, profile) {
							expect(profile.id).not.to.be(userId);
							done();
						}));
				}));
		});

		it('should deny access if received profile data is empty', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: null
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(hlp.auth.getTokenFromHtml(res)).to.be(false);

					// TODO parse+assert error flash message
					done();
				});
		});

		it('should deny access if received profile data does not contain email address', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '2', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ ]
					}
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(hlp.auth.getTokenFromHtml(res)).to.be(false);

					// TODO parse+assert error flash message
					done();
				});
		});

		it('should deny access if received profile data does not contain user id', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'valid.email@vpdb.ch' } ]
					}
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(hlp.auth.getTokenFromHtml(res)).to.be(false);

					// TODO parse+assert error flash message
					done();
				});
		});

		it('should deny access if received profile data does contain neither display name nor username', function(done) {
			request
				.post('/auth/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '123', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'valid.email@vpdb.ch' } ]
					}
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(hlp.auth.getTokenFromHtml(res)).to.be(false);

					// TODO parse+assert error flash message
					done();
				});
		});

	});
});
