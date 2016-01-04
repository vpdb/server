"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

var _ = require('lodash');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The authentication engine of the VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			member: { roles: [ 'member' ] },
			disabled: { roles: [ 'member' ], is_active: false },
			subscribed: { roles: [ 'member' ], _plan: 'subscribed' },
			subscribed1: { roles: [ 'member' ], _plan: 'subscribed' }
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	it('should deny access to the user profile if there is no token in the header', function(done) {
		request
			.get('/api/v1/user')
			.end(hlp.status(401, done));
	});

	describe('when sending an authentication request using user/password', function() {

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
				.end(hlp.status(403, 'Inactive account', done));
		});

		it('should succeed if credentials are correct', function(done) {
			request
				.post('/api/v1/authenticate')
				.save({ path: 'auth/local' })
				.send({ username: hlp.getUser('member').name, password: hlp.getUser('member').password })
				.end(hlp.status(200, done));
		});

	});

	describe('when sending an authentication request using a login token', function() {

		it('should fail if the token is incorrect', function(done) {
			request
				.post('/api/v1/authenticate')
				.send({ token: 'lol-i-am-an-incorrect-token!' })
				.end(hlp.status(400, 'incorrect login token', done));
		});

		it('should fail if the token does not exist', function(done) {
			request
				.post('/api/v1/authenticate')
				.send({ token: 'aaaabbbbccccddddeeeeffff00001111' })
				.end(hlp.status(401, 'invalid token', done));
		});

		it('should fail if the token is not a login token', function(done) {

			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ label: 'Access token', password: hlp.getUser('member').password })
				.end(function(err, res) {

					hlp.doomToken('member', res.body.id);
					hlp.expectStatus(err, res, 201);

					request
						.post('/api/v1/authenticate')
						.send({ token: res.body.token })
						.end(hlp.status(401, 'must be a login token', done));
				});
		});

		it('should fail if the token is expired', function(done) {

			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ password: hlp.getUser('member').password, type: 'login' })
				.end(function(err, res) {

					hlp.doomToken('member', res.body.id);
					hlp.expectStatus(err, res, 201);

					var token = res.body.token;
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('member')
						.send({ expires_at: new Date(new Date().getTime() - 86400000)})
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							request
								.post('/api/v1/authenticate')
								.send({ token: token })
								.end(hlp.status(401, 'token has expired', done));
						});
				});
		});

		it('should fail if the token is inactive', function(done) {

			request
				.post('/api/v1/tokens')
				.as('member')
				.send({ password: hlp.getUser('member').password, type: 'login' })
				.end(function(err, res) {

					hlp.doomToken('member', res.body.id);
					hlp.expectStatus(err, res, 201);

					var token = res.body.token;
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('member')
						.send({ is_active: false })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							request
								.post('/api/v1/authenticate')
								.send({ token: token })
								.end(hlp.status(401, 'token is inactive', done));
						});
				});
		});

		it('should succeed if the token is valid', function(done) {

			request
				.post('/api/v1/tokens')
				.as('member')
				.set('User-Agent', 'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.8.1) Gecko/20061024 Firefox/2.0 (Swiftfox)')
				.send({ password: hlp.getUser('member').password, type: 'login' })
				.end(function(err, res) {

					hlp.doomToken('member', res.body.id);
					hlp.expectStatus(err, res, 201);

					request
						.post('/api/v1/authenticate')
						.send({ token: res.body.token })
						.end(hlp.status(200, done));
				});
		});
	});

	describe('when a primary access token is provided in the header', function() {

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

	describe('when an application access token is provided in the header', function() {

		it('should fail if the token is invalid', function(done) {
			request
				.get('/api/v1/user')
				.set('Authorization', 'Bearer 688f4864ca7be0fe4bfe866acbf6b151')
				.end(hlp.status(401, 'Invalid access token', done));
		});

		it('should fail if the user has the wrong plan', function(done) {

			// 1. create token for subscribed user
			request
				.post('/api/v1/tokens')
				.as('subscribed1')
				.send({ label: 'After plan downgrade token', password: hlp.getUser('subscribed1').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					// 2. downgrade user to free
					var token = res.body.token;
					var user = hlp.getUser('subscribed1');
					user._plan = 'free';
					request
						.put('/api/v1/users/' + user.id)
						.as('__superuser')
						.send(_.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]))
						.end(function(err, res) {

							// 3. fail with app token
							hlp.expectStatus(err, res, 200);
							request
								.get('/api/v1/user')
								.set('Authorization', 'Bearer ' + token)
								.end(hlp.status(401, 'does not allow the use of application access tokens', done));
						});
				});
		});

		it('should fail if the token is inactive', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Inactive token', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					var token = res.body.token;
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('subscribed')
						.send({ is_active: false })
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							request
								.get('/api/v1/user')
								.set('Authorization', 'Bearer ' + token)
								.end(hlp.status(401, 'is inactive', done));
						});
				});
		});

		it('should fail if the token is expired', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Expired token', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					var token = res.body.token;
					request
						.patch('/api/v1/tokens/' + res.body.id)
						.as('subscribed')
						.send({ expires_at: new Date(new Date().getTime() - 86400000)})
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							request
								.get('/api/v1/user')
								.set('Authorization', 'Bearer ' + token)
								.end(hlp.status(401, 'has expired', done));
						});
				});
		});

		it('should fail if the token is a login token', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Valid token', password: hlp.getUser('subscribed').password, type: 'login' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.get('/api/v1/user')
						.set('Authorization', 'Bearer ' + res.body.token)
						.end(hlp.status(401, 'must be an access token', done));
				});
		});

		it('should succeed if the token is valid', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Valid token', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.get('/api/v1/user')
						.set('Authorization', 'Bearer ' + res.body.token)
						.end(hlp.status(200, done));
				});
		});
	});

	describe('when authorization is provided in the URL', function() {

		it('should able to get an access token if the auth token is valid', function(done) {
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

		it('should fail if the request method is not GET or HEAD', function(done) {
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

		it('should fail if the token is an application access token', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'App token', password: hlp.getUser('subscribed').password })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.get('/api/v1/user')
						.query({ token: res.body.token })
						.end(hlp.status(401, 'must be provided in the header', done));
				});
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

	});

});
