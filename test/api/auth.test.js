"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

const _ = require('lodash');
const expect = require('expect.js');
const jwt = require('jwt-simple');
const config = require('../../src/config/settings-test');

const ApiClient = require('../modules/api.client');
const api = new ApiClient();

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
			await api.saveResponse('auth/local')
				.post('/v1/authenticate', {})
				.then(res => res.expectError(400, 'must supply a username'));
		});

		it('should fail if username is non-existent', async () => {
			await api.saveResponse('auth/local')
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
			await api.save('auth/local')
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
			const now = new Date();
			const token = jwt.encode({
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
			const now = new Date();
			const token = jwt.encode({
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

		it('should fail if the user has the wrong plan', async () => {

			// 1. create token for subscribed user
			res = await api.as('subscribed1')
				.markTeardown()
				.post('/v1/tokens', { label: 'After plan downgrade token', password: api.getUser('subscribed1').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));
			const token = res.data.token;

			// 2. downgrade user to free
			const user = api.getUser('subscribed1');
			user._plan = 'free';
			await api.asRoot()
				.put('/v1/users/' + user.id, _.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]))
				.then(res => res.expectStatus(200));

			// 3. fail with app token
			await api.withToken(token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'does not allow the use of app tokens'));
		});

		it('should fail if the token is inactive', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Inactive token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));
			const token = res.data.token;

			await api.as('subscribed')
				.patch('/v1/tokens/' + res.data.id, { is_active: false })
				.then(res => res.expectStatus(200));

			await api.withToken(token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'is inactive'));
		});

		it('should fail if the token is expired', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Expired token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));
			const token = res.data.token;

			await api.as('subscribed')
				.patch('/v1/tokens/' + res.data.id, { expires_at: new Date(new Date().getTime() - 86400000) })
				.then(res => res.expectStatus(200));

			await api.withToken(token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'has expired'));
		});

		it('should fail if the token is a login token', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Valid token', password: api.getUser('subscribed').password, scopes: [ 'login' ] })
				.then(res => res.expectStatus(201));

			await api.withToken(res.data.token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'invalid scope: [ "login" ]'));
		});

		it('should succeed if the token is valid', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Valid token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));

			await api.withToken(res.data.token)
				.get('/v1/user')
				.then(res => res.expectStatus(200));

		});
	});

	describe('when an application token is provided in the header', () => {
		let ipsUser, githubUser;
		let appToken;

		before(async () => {

			ipsUser = await api.createOAuthUser('oauth1', 'ipbtest');
			githubUser = await api.createOAuthUser('oauth2', 'github');

			let res = await api.as('admin').markTeardown().post('/v1/tokens', {
				label: 'Auth test token',
				password: api.getUser('admin').password,
				provider: 'ipbtest', type: 'application',
				scopes: [ 'community', 'service' ]
			}).then(res => res.expectStatus(201));

			appToken = res.data.token;
		});

		it('should fail when no user header is provided', async () => {
			await api.withToken(appToken)
				.get('/v1/user')
				.then(res => res.expectError(400, 'must provide "x-vpdb-user-id" or "x-user-id" header'));
		});

		it('should fail when a non-existent vpdb user header is provided', async () => {
			await api.withToken(appToken)
				.withHeader('X-Vpdb-User-Id', 'blürpsl')
				.get('/v1/user')
				.then(res => res.expectError(400, 'no user with id'));
		});

		it('should fail with a vpdb user header of a different provider', async () => {
			await api.withToken(appToken)
				.withHeader('X-Vpdb-User-Id', api.getUser('member').id)
				.get('/v1/user')
				.then(res => res.expectError(400, 'user has not been authenticated with'));
		});

		it('should fail on a out-of-scope resource', async () => {
			await api.withToken(appToken)
				.withHeader('X-Vpdb-User-Id', ipsUser.id)
				.post('/v1/backglasses', {})
				.then(res => res.expectError(401, 'token has an invalid scope'));
		});

		it('should fail with a non-existent user header', async () => {
			await api.withToken(appToken)
				.withHeader('X-User-Id', 'blarp')
				.get('/v1/user')
				.then(res => res.expectError(400, 'no user with id'));
		});

		it('should fail with a user header from a different provider', async () => {
			await api.withToken(appToken)
				.withHeader('X-User-Id', githubUser.github.id)
				.get('/v1/user')
				.then(res => res.expectError(400, 'no user with id'));
		});

		it('should succeed with the correct provider user header', async () => {
			await api.withToken(appToken)
				.withHeader('X-User-Id', ipsUser.ipbtest.id)
				.get('/v1/user')
				.then(res => {
					res.expectStatus(200);
					expect(res.data.id).to.be(ipsUser.id);
				});
		});

		it('should succeed with the correct vpdb user header', async () => {
			await api.withToken(appToken)
				.withHeader('X-Vpdb-User-Id', ipsUser.id)
				.get('/v1/user')
				.then(res => {
					res.expectStatus(200);
					expect(res.data.id).to.be(ipsUser.id);
				});
		});

		it('should be able to create an oauth user', async () => {
			await api.withToken(appToken)
				.put('/v1/users', { provider_id: 1234, email: 'oauth@vpdb.io', username: 'oauthtest' })
				.then(res => {
					res.expectStatus(201);
					api.tearDownUser(res.data.id);
					expect(res.data.provider).to.be('ipbtest');
				});
		});
	});

	describe('when authorization is provided in the URL', () => {

		it('should able to get an access token if the auth token is valid', async () => {
			const path = '/api/v1/user';
			res = await api.as('member')
				.on('storage')
				.post('/v1/authenticate', { paths: path });
			res.expectStatus(200);
			expect(res.data).to.be.an('object');
			expect(res.data).to.have.key(path);

			await api.withQuery({ token: res.data[path] })
				.get('/v1/user')
				.then(res => res.expectStatus(200));
		});

		it('should fail if the token is not path-restricted', async () => {
			await api.withQuery({ token: api.getToken('member') })
				.get('/v1/user')
				.then(res => res.expectError(401, 'valid for any path cannot'));
		});

		it('should fail if the token is for a different path', async () => {
			const path = '/storage/v1/files/12345';
			const token = await api.retrieveStorageToken('member', path);
			await api.withQuery({ token: token })
				.get('/v1/user')
				.then(res => res.expectError(401, 'is only valid for'));
		});

		it('should fail if the request method is not GET or HEAD', async () => {
			const path = '/storage/v1/files';
			const token = await api.retrieveStorageToken('member', path);
			await api.withQuery({ token: token })
				.on('storage')
				.post('/v1/files', {})
				.then(res => res.expectError(401, 'is only valid for'));
		});

		it('should fail if the token is corrupt or unreadable', async () => {
			await api.withQuery({ token: 'abcd.123.xyz' })
				.get('/v1/user')
				.then(res => res.expectError(401, 'Bad JSON Web Token'));
		});

		it('should fail if the token is an application access token', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'App token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));

			await api.withQuery({ token: res.data.token })
				.get('/v1/user')
				.then(res => res.expectError(401, 'must be provided in the header'));
		});
	});

	describe('when authenticating via GitHub', () => {

		it('should create a new user and return the user profile along with a valid token', async () => {
			const profile = await api.post('/v1/authenticate/mock', {
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
			}).then(res => api.retrieveUserProfile(res));
			api.tearDownUser(profile.id);
			expect(profile.name).to.be('Motorhead Dude23');
		});

		it('should match the same already registered Github user even though email and name are different', async () => {
			const profile1 = await api.createOAuthUser('github1', 'github', { id: '65465', emails: [ 'mockuser@vpdb.io' ]});
			const profile2 = await api.createOAuthUser('github2', 'github', { id: '65465', emails: [ 'other.email@vpdb.io' ]}, { teardown: false });
			expect(profile1.id).to.be(profile2.id);
		});

		it('should match an already registered local user with the same email address', async () => {

			const localUser = api.getUser('member');
			const oauthUser = await api.createOAuthUser('github3', 'github', { id: '1234xyz', emails: [ localUser.email ]}, { teardown: false });

			expect(oauthUser.id).to.be(localUser.id);
		});

		it('should fail when the oauth email changes to an existing address', async () => {

			const oauthProfile = api.generateOAuthUser('github', { emails: [ 'first.email@vpdb.io' ]});
			const localProfile = api.generateUser({ email: 'second.email@vpdb.io', roles: ['member'], skipEmailConfirmation: true });

			// create oauth user with email1
			await api.markTeardown('user.id', '/v1/users')
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			// create local user with email2
			await api.markTeardown()
				.post('/v1/users', localProfile)
				.then(res => res.expectStatus(201));

			// change email1 at provider to email2
			oauthProfile.profile.emails = [ { value: 'second.email@vpdb.io' } ];

			// login with oauth user => 409
			await api.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(409));
		});

	});

	describe('when authenticating via IPB', () => {

		it('should create a new user and return the user profile along with a valid token', async () => {
			await api.post('/v1/authenticate/mock', {
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
			}).then(res => api.retrieveUserProfile(res));
		});

		it('should match an already registered GitHub user with the same email address', async () => {
			const email = 'imthesame@vpdb.io';
			const ipsUser = api.generateOAuthUser('ipbtest',   { emails: [ email ] });
			const githubUser = api.generateOAuthUser('github', { emails: [ email ] });

			res = await api.markTeardown('user.id', '/v1/users')
				.post('/v1/authenticate/mock', ipsUser)
				.then(res => api.retrieveUserProfile(res));

			const userId = res.id;
			res = await api.post('/v1/authenticate/mock', githubUser)
				.then(res => api.retrieveUserProfile(res));

			expect(res.id).to.be(userId);
		});

		it('should not match an already registered GitHub user even though ID, username and display name are the same', async () => {
			const id = '23';
			const username = 'doofus';
			const displayname = 'Doof Us';

			const ipsUser = api.generateOAuthUser('ipbtest',   { id: id, name: username, displayName: displayname });
			const githubUser = api.generateOAuthUser('github', { id: id, name: username, displayName: displayname });

			res = await api.markTeardown('user.id', '/v1/users')
				.post('/v1/authenticate/mock', ipsUser)
				.then(res => api.retrieveUserProfile(res));

			const userId = res.id;
			res = await api.post('/v1/authenticate/mock', githubUser)
				.then(res => api.retrieveUserProfile(res));

			expect(res.id).not.to.be(userId);
		});

		it('should deny access if received profile data is empty', async () => {
			await api.post('/v1/authenticate/mock', {
				provider: 'ipboard',
				providerName: 'ipbtest',
				profile: null
			}).then(res => res.expectError(500, 'No profile received'));
		});

		it('should deny access if received profile data does not contain email address', async () => {
			await api.post('/v1/authenticate/mock', {
				provider: 'ipboard',
				providerName: 'ipbtest',
				profile: { provider: 'ipbtest', id: '2', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
					emails: [ ]
				}
			}).then(res => res.expectError(500, 'does not contain any email'));
		});

		it('should deny access if received profile data does not contain user id', async () => {
			await api.post('/v1/authenticate/mock', {
				provider: 'ipboard',
				providerName: 'ipbtest',
				profile: { provider: 'ipbtest', username: 'test', displayName: 'test i am', profileUrl: 'http://localhost:8088/index.php?showuser=2',
					emails: [ { value: 'valid.email@vpdb.io' } ]
				}
			}).then(res => res.expectError(500, 'does not contain user id'));
		});

	});

});
