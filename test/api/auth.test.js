"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

const _ = require('lodash');
const request = require('superagent');
const expect = require('expect.js');
const jwt = require('jwt-simple');
const config = require('../../src/config/settings-test');

const ApiClient = require('../modules/api.client');

const superagentTest = require('../modules/superagent-test');
const hlp = require('../modules/helper');

const api = new ApiClient();

superagentTest(request);

describe('The authentication engine of the VPDB API', () => {

	let res;
	before(async () => {
		await api.setupUsers({
			admin: { roles: ['admin'], _plan: 'subscribed' },
			member: { roles: [ 'member' ] },
			disabled: { roles: [ 'member' ], is_active: false },
			subscribed: { roles: [ 'member' ], _plan: 'subscribed' },
			subscribed1: { roles: [ 'member' ], _plan: 'subscribed' }
		});
	});

	after(async () => await api.teardown());

	it('should deny access to the user profile if there is no token in the header', async () => {
		await api.get('/v1/user').then(res => res.expectStatus(401));
	});

	describe('when sending an authentication request using user/password', () => {

		it('should fail if no credentials are posted', async () => {
			await api.saveResponse({ path: 'auth/local' })
				.post('/v1/authenticate', {})
				.then(res => res.expectError(400, 'must supply a username'));
		});

		it('should fail if username is non-existent', async () => {
			await api.saveResponse({ path: 'auth/local' })
				.post('/v1/authenticate', { username: '_______________', password: 'xxx' })
				.then(res => res.expectError(401, 'Wrong username or password'));
		});

		it('should fail if username exists but wrong password is supplied', async () => {
			await api.post('/v1/authenticate', { username: api.getUser('member').name, password: 'xxx' })
				.then(res => res.expectError(401, 'Wrong username or password'));
		});

		it('should fail if credentials are correct but user is disabled', async () => {
			await api.post('/v1/authenticate', { username: api.getUser('disabled').name, password: api.getUser('disabled').password })
				.then(res => res.expectError(403, 'Inactive account'));
		});

		it('should succeed if credentials are correct', async () => {
			await api.save({ path: 'auth/local' })
				.post('/v1/authenticate', { username: api.getUser('member').name, password: api.getUser('member').password })
				.then(res => res.expectStatus(200));
		});

	});

	describe('when sending an authentication request using a login token', () => {

		it('should fail if the token is incorrect', async () => {
			await api.post('/v1/authenticate', { token: 'lol-i-am-an-incorrect-token!' })
				.then(res => res.expectError(400, 'incorrect login token'));
		});

		it('should fail if the token does not exist', async () => {
			await api.post('/v1/authenticate', { token: 'aaaabbbbccccddddeeeeffff00001111' })
				.then(res => res.expectError(401, 'invalid token'));
		});

		it('should fail if the token is not a login token', async () => {
			res = await api.as('subscribed')
				.post('/v1/tokens', { label: 'Access token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));

			await api.post('/v1/authenticate', { token: res.data.token })
				.then(res => res.expectError(401, 'must exclusively be "login"'));
		});

		it('should fail if the token is expired', async () => {
			res = await api.as('member')
				.post('/v1/tokens', { password: api.getUser('member').password, scopes: [ 'login' ] })
				.then(res => res.expectStatus(201));
			const token = res.data.token;

			await api.as('member')
				.patch('/v1/tokens/' + res.data.id, { expires_at: new Date(new Date().getTime() - 86400000)})
				.then(res => res.expectStatus(200));

			await api.post('/v1/authenticate', { token: token })
				.then(res => res.expectError(401, 'token has expired'));
		});

		it('should fail if the token is inactive', async () => {
			res = await api.as('member')
				.post('/v1/tokens', { password: api.getUser('member').password, scopes: [ 'login' ] })
				.then(res => res.expectStatus(201));
			const token = res.data.token;
			await api.as('member')
				.patch('/v1/tokens/' + res.data.id, { is_active: false })
				.then(res => res.expectStatus(200));
			await api.post('/v1/authenticate', { token: token })
				.then(res => res.expectError(401, 'token is inactive'));
		});

		it('should succeed if the token is valid', async () => {
			res = await api.as('member')
				.withHeader('User-Agent', 'Mozilla/5.0 (X11; U; Linux i686; en-US; rv:1.8.1) Gecko/20061024 Firefox/2.0 (Swiftfox)')
				.post('/v1/tokens', { password: api.getUser('member').password, scopes: [ 'login' ] })
				.then(res => res.expectStatus(201));
			await api.post('/v1/authenticate', { token: res.data.token })
				.then(res => res.expectStatus(200));
		});
	});

	describe('when a JWT is provided in the header', () => {

		it('should grant access to the user profile if the token is valid', async () => {
			await api
				.withHeader('Authorization', 'Bearer ' + api.getToken('member'))
				.get('/v1/user')
				.then(res => res.expectStatus(200));
		});

		it('should fail if the authorization header has no type', async () => {
			await api
				.withHeader('Authorization', api.getToken('member'))
				.get('/v1/user')
				.then(res => res.expectError(401, 'Bad Authorization header'));
		});

		it('should fail if the authorization header has a different type than "Bearer"', async () => {
			await api
				.withHeader('Authorization', 'Token ' + api.getToken('member'))
				.get('/v1/user')
				.then(res => res.expectError(401, 'Bad Authorization header'));
		});

		it('should fail if the token is corrupt or unreadable', async () => {
			await api
				.withHeader('Authorization', 'Bearer abcd.123.xyz')
				.get('/v1/user')
				.then(res => res.expectError(401, 'Bad JSON Web Token'));
		});

		it('should fail if the token has expired', async () => {
			let now = new Date();
			let token = jwt.encode({
				iss: api.getUser('member').id,
				iat: now,
				exp: new Date(now.getTime() - 100), // expired
				irt: false
			}, config.vpdb.secret);
			await api.withToken(token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'token has expired'));
		});

		it('should fail if the user does not exist', async () => {
			let now = new Date();
			let token = jwt.encode({
				iss: -1, // invalid
				iat: now,
				exp: new Date(now.getTime() + config.vpdb.storageTokenLifetime),
				irt: false
			}, config.vpdb.secret);
			await api.withToken(token)
				.get('/v1/user')
				.then(res => res.expectError(403, 'no user with id'));
		});
	});

	describe('when a personal token is provided in the header', function() {

		it('should fail if the token is invalid', async () => {
			await api.withToken('688f4864ca7be0fe4bfe866acbf6b151')
				.get('/v1/user')
				.then(res => res.expectError(401, 'invalid app token'));
		});

		it('should fail if the user has the wrong plan', function(done) {

			// 1. create token for subscribed user
			request
				.post('/api/v1/tokens')
				.as('subscribed1')
				.send({ label: 'After plan downgrade token', password: hlp.getUser('subscribed1').password, scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);

					// 2. downgrade user to free
					const token = res.body.token;
					const user = hlp.getUser('subscribed1');
					user._plan = 'free';
					request
						.put('/api/v1/users/' + user.id)
						.as('__superuser')
						.send(_.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]))
						.end(function(err, res) {
							hlp.expectStatus(err, res, 200);

							// 3. fail with app token
							request
								.get('/api/v1/user')
								.set('Authorization', 'Bearer ' + token)
								.end(hlp.status(401, 'does not allow the use of app tokens', done));
						});
				});
		});

		it('should fail if the token is inactive', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Inactive token', password: hlp.getUser('subscribed').password, scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					const token = res.body.token;
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
				.send({ label: 'Expired token', password: hlp.getUser('subscribed').password, scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					const token = res.body.token;
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
				.send({ label: 'Valid token', password: hlp.getUser('subscribed').password, scopes: [ 'login' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.get('/api/v1/user')
						.set('Authorization', 'Bearer ' + res.body.token)
						.end(hlp.status(401, 'invalid scope: [ "login" ]', done));
				});
		});

		it('should succeed if the token is valid', function(done) {
			request
				.post('/api/v1/tokens')
				.as('subscribed')
				.send({ label: 'Valid token', password: hlp.getUser('subscribed').password, scopes: [ 'all' ] })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					request
						.get('/api/v1/user')
						.set('Authorization', 'Bearer ' + res.body.token)
						.end(hlp.status(200, done));
				});
		});
	});

	describe('when an application token is provided in the header', () => {
		let oauthUser1, oauthUser2;
		let appToken;
		before(done => {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '2', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2', emails: [ { value: 'test@vpdb.io' } ], photos: [ { value: 'http://localhost:8088/uploads/' } ] }
				}).end((err, res) => {
					hlp.expectStatus(err, res, 200);
					hlp.doomUser(res.body.user.id);
					oauthUser1 = res.body.user;
					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							providerName: 'github',
							profile: { provider: 'github', id: '23', username: 'githubuser', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2', emails: [ { value: 'test2@vpdb.io' } ], photos: [ { value: 'http://localhost:8088/uploads/' } ] }
						}).end((err, res) => {
							hlp.expectStatus(err, res, 200);
							hlp.doomUser(res.body.user.id);
							oauthUser2 = res.body.user;
							request
								.post('/api/v1/tokens')
								.as('admin')
								.send({ label: 'Auth test token', password: hlp.getUser('admin').password, provider: 'ipbtest', type: 'application', scopes: [ 'community', 'service' ] })
								.end((err, res) => {
									hlp.expectStatus(err, res, 201);
									appToken = res.body.token;
									done();
							});
						});
				});
		});

		it('should fail when no user header is provided', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.end(hlp.status(400, 'must provide "x-vpdb-user-id" or "x-user-id" header', done));
		});

		it('should fail when a non-existent vpdb user header is provided', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-Vpdb-User-Id', 'blürpsl')
				.end(hlp.status(400, 'no user with id', done));
		});

		it('should fail with a vpdb user header of a different provider', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-Vpdb-User-Id', hlp.getUser('member').id)
				.end(hlp.status(400, 'user has not been authenticated with', done));
		});

		it('should fail on a out-of-scope resource', done => {
			request
				.post('/api/v1/backglasses')
				.send({})
				.with(appToken)
				.set('X-Vpdb-User-Id', oauthUser1.id)
				.end(hlp.status(401, 'token has an invalid scope', done));
		});

		it('should fail with a non-existent user header', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-User-Id', 'blarp')
				.end(hlp.status(400, 'no user with id', done));
		});

		it('should fail with a user header from a different provider', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-User-Id', oauthUser2.github.id)
				.end(hlp.status(400, 'no user with id', done));
		});

		it('should succeed with the correct provider user header', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-User-Id', '2')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.id).to.be(oauthUser1.id);
					done();
				});
		});

		it('should succeed with the correct vpdb user header', done => {
			request
				.get('/api/v1/user')
				.with(appToken)
				.set('X-Vpdb-User-Id', oauthUser1.id)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.id).to.be(oauthUser1.id);
					done();
				});
		});

		it('should be able to create an oauth user', done => {
			request
				.put('/api/v1/users')
				.with(appToken)
				.send({ provider_id: 1234, email: 'oauth@vpdb.io', username: 'oauthtest' }).end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomUser(res.body.id);
					expect(res.body.provider).to.be('ipbtest');
					done();
			});
		});
	});

	describe('when authorization is provided in the URL', function() {

		it('should able to get an access token if the auth token is valid', function(done) {
			const path = '/api/v1/user';
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
			const path = '/storage/v1/files/12345';
			hlp.storageToken(request, 'member', path, function(token) {
				request
					.get('/api/v1/user')
					.query({ token: token })
					.end(hlp.status(401, 'is only valid for', done));
			});
		});

		it('should fail if the request method is not GET or HEAD', function(done) {
			const path = '/storage/v1/files';
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
				.send({ label: 'App token', password: hlp.getUser('subscribed').password, scopes: [ 'all' ] })
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
						displayName: 'Motörhead Dude-23',
						username: 'motorhead',
						profileUrl: 'https://github.com/mockuser',
						emails: [
							{ value: 'motorhead@vpdb.io' }
						],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
					expect(profile.name).to.be('Motorhead Dude23');
					done();
				}));
		});

		it('should match the same already registered Github user even though email and name are different', function(done) {
			const githubId = '65465';
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'github',
					profile: { provider: 'github', id: githubId, displayName: null, username: 'mockuser', profileUrl: 'https://github.com/mockuser',
						emails: [ { value: 'mockuser@vpdb.io' } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile1) {

					request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: githubId, displayName: 'bleh', username: 'foo',
								emails: [ { value: 'other.email@vpdb.io' } ]
							}
						}).end(hlp.auth.assertToken(request, function(err, profile2) {
							expect(profile1.id).to.be(profile2.id);
							done();
						}));
				}));
		});

		it('should match an already registered local user with the same email address', function(done) {
			const localUser = hlp.getUser('member');
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

		it('should fail when the oauth email changes to an existing address', done => {
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'github',
					profile: {
						provider: 'github',
						id: '12345',
						displayName: 'User changing email',
						username: 'mailchanger',
						profileUrl: 'https://github.com/mailchanger',
						emails: [
							{ value: 'first.email@vpdb.io' }
						],
						_raw: '(not mocked)', _json: { not: 'mocked '}
					}
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					hlp.doomUser(res.body.user.id);

				request
					.post('/api/v1/users')
					.send(_.extend(hlp.genUser({ roles: ['member'], email: 'second.email@vpdb.io' }), { skipEmailConfirmation: true }, ))
					.end(function(err, res) {
						hlp.expectStatus(err, res, 201);
						hlp.doomUser(res.body.id);
						request
							.post('/api/v1/authenticate/mock')
							.send({
								provider: 'github',
								profile: {
									provider: 'github',
									id: '12345',
									displayName: 'User changing email',
									username: 'mailchanger',
									profileUrl: 'https://github.com/mailchanger',
									emails: [
										{ value: 'second.email@vpdb.io' }
									],
									_raw: '(not mocked)', _json: { not: 'mocked '}
								}
							}).end(hlp.status(409, done));
					});
			});
		})

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
						emails: [ { value: 'test@vpdb.io' } ],
						photos: [ { value: 'http://localhost:8088/uploads/' } ]
					}
				})
				.end(hlp.auth.assertToken(request, done));
		});

		it('should match an already registered GitHub user with the same email address', function(done) {
			const email = 'imthesame@vpdb.io';
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: '3', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: email } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
				const userId = profile.id;
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
			const id = '23';
			const username = 'doofus';
			const displayname = 'Doof Us';
			request
				.post('/api/v1/authenticate/mock')
				.send({
					provider: 'ipboard',
					providerName: 'ipbtest',
					profile: { provider: 'ipbtest', id: id, username: username, displayName: displayname, profileUrl: 'http://localhost:8088/index.php?showuser=2',
						emails: [ { value: 'email1@vpdb.io' } ]
					}
				}).end(hlp.auth.assertToken(request, function(err, profile) {
				const userId = profile.id;
				request
						.post('/api/v1/authenticate/mock')
						.send({
							provider: 'github',
							profile: { provider: 'github', id: id, username: username, displayName: displayname, profileUrl: 'https://github.com/mockuser',
								emails: [ { value: 'email2@vpdb.io' } ]
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
						emails: [ { value: 'valid.email@vpdb.io' } ]
					}
				}).end(hlp.status(500, 'does not contain user id', done));
		});

	});

});
