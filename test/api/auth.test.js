"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication engine of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ] },
			disabled: { roles: [ 'member' ], is_active: false }
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	it('should deny access to the user profile if there is neither a token in the header nor the URL', function(done) {
		request
			.get('/api/v1/user')
			.end(hlp.status(401, done));
	});

	describe('when sending an authentication request', function() {

		it('should fail if no credentials are posted', function(done) {
			request
				.post('/api/v1/authenticate')
				.saveResponse({ path: 'auth/local' })
				.send({})
				.end(hlp.status(400, 'must supply a username', done));
		});

		it('should fail if username is non-existent', function(done) {
			request
				.post('/api/v1/authenticate')
				.saveResponse({ path: 'auth/local' })
				.send({ username: '_______________', password: 'xxx' })
				.end(hlp.status(401, 'Wrong username or password', done));
		});

		it('should fail if username exists but wrong password is supplied', function(done) {
			request
				.post('/api/v1/authenticate')
				.send({ username: hlp.getUser('member').name, password: 'xxx' })
				.end(hlp.status(401, 'Wrong username or password', done));
		});

		it('should fail if credentials are correct but user is disabled', function(done) {
			request
				.post('/api/v1/authenticate')
				.send({ username: hlp.getUser('disabled').name, password: hlp.getUser('disabled').password })
				.end(hlp.status(401, 'Inactive account', done));
		});

		it('should succeed if credentials are correct', function(done) {
			request
				.post('/api/v1/authenticate')
				.save({ path: 'auth/local' })
				.send({ username: hlp.getUser('member').name, password: hlp.getUser('member').password })
				.end(hlp.status(200, done));
		});

	});

	describe('when authorization is provided in the header', function() {

		it('should grant access to the user profile if the token is valid', function(done) {
			request
				.get('/api/v1/user')
				.set('Authorization', 'Bearer ' + request.tokens.member)
				.end(hlp.status(200, done));
		});

		it('should fail if the authorization header has no type', function(done) {
			request
				.get('/api/v1/user')
				.set('Authorization', request.tokens.member)
				.end(hlp.status(401, 'Bad Authorization header', done));
		});

		it('should fail if the authorization header has a different type than "Bearer"', function(done) {
			request
				.get('/api/v1/user')
				.set('Authorization', 'Token ' + request.tokens.member)
				.end(hlp.status(401, 'Bad Authorization header', done));
		});

		it('should fail if the token is corrupt or unreadable', function(done) {
			request
				.get('/api/v1/user')
				.set('Authorization', 'Bearer abcd.123.xyz')
				.end(hlp.status(401, 'Bad JSON Web Token', done));
		});
	});

	describe('when authorization is provided in the URL', function() {

		it('should grant access to the user profile if the token is valid', function(done) {
			var path = '/api/v1/user';
			request
				.post('/storage/v1/authenticate')
				.as('member')
				.send({ paths: path })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('object');
					expect(res.body).to.have.key(path);
					request
						.get(path)
						.query({ token: res.body[path] })
						.end(hlp.status(200, done));
				});
		});

		it('should fail if the token is not path-restricted', function(done) {
			request
				.get('/api/v1/user')
				.query({ token: request.tokens.member })
				.end(hlp.status(401, 'valid for any path cannot', done));
		});

		it('should fail if the token is for a different path', function(done) {
			var path = '/storage/v1/files/12345';
			hlp.storageToken(request, 'member', path, function(token) {
				request
					.get('/api/v1/user')
					.query({ token: token })
					.end(hlp.status(401, 'is only valid for', done));
			});
		});

		it('should fail if the request method is not GET', function(done) {
			var path = '/storage/v1/files';
			hlp.storageToken(request, 'member', path, function(token) {
				request
					.post(path)
					.query({ token: token })
					.send({})
					.end(hlp.status(401, 'is only valid for', done));
			});
		});

		it('should fail if the token is corrupt or unreadable', function(done) {
			request
				.get('/api/v1/user')
				.query({ token: 'abcd.123.xyz' })
				.end(hlp.status(401, 'Bad JSON Web Token', done));
		});
	});

	describe('when authenticating via GitHub', function() {

		it('should create a new user and return the user profile along with a valid token', function (done) {
			request
				.post('/api/v1/authenticate/mock')
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
				}).end(hlp.auth.assertToken(request, done));
		});

		it('should match the same already registered Github user even though email and name are different', function(done) {
			var githubId = '65465';
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'github',
					profile: { provider: 'github', id: githubId, displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
						emails: [ { value: 'mockuser@vpdb.ch' } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile1) {

					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: githubId, displayName: 'bleh', username: 'foo',
								emails: [ { value: 'other.email@vpdb.ch' } ]
							}
						}).end(hlp.auth.assertToken(request, function(err, profile2) {
							expect(profile1.id).to.be(profile2.id);
							done();
						}));
				}));
		});

		it('should match an already registered local user with the same email address', function(done) {
			var localUser = hlp.getUser('member');
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'github',
					profile: { provider: 'github', id: '1234xyz', displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
						emails: [ { value: localUser.email } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
					expect(profile.id).to.be(localUser.id);
					done();
				}, true));
		});

		it('should change the account type to "local" after setting a password');
	});

	describe('when authenticating via IPB', function() {

		it('should create a new user and return the user profile along with a valid token', function(done) {
			request
				.post('/api/v1/authenticate/mock')
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
				.end(hlp.auth.assertToken(request, done));
		});

		it('should match an already registered GitHub user with the same email address', function(done) {
			var email = 'imthesame@vpdb.ch';
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '3', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: email } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
					var userId = profile.id;
					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: '1234abcd', displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
								emails: [ { value: email } ]
							}
						}).end(hlp.auth.assertToken(request, function(err, profile) {
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
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: id, username: username, displayName: displayname, profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'email1@vpdb.ch' } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
					var userId = profile.id;
					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: id, username: username, displayName: displayname, profileUrl: 'https://github.com/mockuser',
								emails: [ { value: 'email2@vpdb.ch' } ]
							}
						}).end(hlp.auth.assertToken(request, function(err, profile) {
							expect(profile.id).not.to.be(userId);
							done();
						}));
				}));
		});

		it('should deny access if received profile data is empty', function(done) {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: null
				}).end(hlp.status(500, 'No profile received', done));
		});

		it('should deny access if received profile data does not contain email address', function(done) {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '2', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ ]
					}
				}).end(hlp.status(500, 'does not contain any email', done));
		});

		it('should deny access if received profile data does not contain user id', function(done) {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'valid.email@vpdb.ch' } ]
					}
				}).end(hlp.status(500, 'does not contain user id', done));
		});

		it('should deny access if received profile data does contain neither display name nor username', function(done) {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '123', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'valid.email@vpdb.ch' } ]
					}
				}).end(hlp.status(500, 'does contain neither display name nor username', done));
		});

	});

});
