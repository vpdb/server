/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict"; /*global describe, before, after, beforeEach, afterEach, it*/

const _ = require('lodash');
const expect = require('expect.js');
const jwt = require('jwt-simple');
const config = require('../../../config/settings.test');

const ApiClient = require('../../test/api.client');
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

		it('should fail if credentials are correct but user has not confirmed email', async () => {
			const unconfirmedUser = await api.createUser(undefined, undefined, { keepUnconfirmed: true });
			await api.post('/v1/authenticate', { username: unconfirmedUser.name, password: unconfirmedUser.password })
				.then(res => res.expectError(403, 'inactive until you confirm your email address'));
		});

		it('should block the IP after the nth attempt', async () => {

			// succeed first to clear previous counter
			await api
				.post('/v1/authenticate', { username: api.getUser('member').name, password: api.getUser('member').password })
				.then(res => res.expectStatus(200));

			// fail 5x
			for (let i = 0; i < 10; i++) {
				await api.post('/v1/authenticate', { username: 'xxx', password: 'xxx' }).then(res => res.expectError(401));
			}
			res = await api.post('/v1/authenticate', { username: 'xxx', password: 'xxx' }).then(res => res.expectStatus(429));
			expect(res.data.wait).to.be(1);

			await new Promise(resolve => setTimeout(resolve, 1000));
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

	describe('when a JWT is provided', () => {

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

		it('should fail when trying to require a login token', async () => {
			let res = await api.as('admin').markTeardown().post('/v1/tokens', {
				label: 'Auth test token',
				password: api.getUser('admin').password,
				provider: 'ipbtest', type: 'provider',
				scopes: [ 'community', 'service' ]
			}).then(res => res.expectStatus(201));
			await api
				.post('/v1/authenticate', { token: res.data.token })
				.then(res => res.expectError(401, 'cannot use token of type "provider"'));
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
				.then(res => res.expectError(401, 'invalid application token'));
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
				.then(res => res.expectError(401, 'does not allow the use of personal tokens'));
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

		it('should fail when trying to login', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Valid token', password: api.getUser('subscribed').password, scopes: [ 'login' ] })
				.then(res => res.expectStatus(201));

			await api.withToken(res.data.token)
				.get('/v1/user')
				.then(res => res.expectError(401, 'invalid scope: [ "login" ]'));
		});

		it('should fail if the token is a login token', async () => {
			res = await api.as('subscribed')
				.markTeardown()
				.post('/v1/tokens', { label: 'Valid token', password: api.getUser('subscribed').password, scopes: [ 'all' ] })
				.then(res => res.expectStatus(201));

			await api
				.post('/v1/authenticate', { token: res.data.token })
				.then(res => res.expectError(401, 'must exclusively be "login"'));
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

	describe('when a provider token is provided in the header', () => {
		let ipsUser, githubUser;
		let ipsProfile, githubProfile;
		let appToken;

		before(async () => {

			let data = await api.createOAuthUser('ipbtest');
			ipsUser = data.user;
			ipsProfile = ipsUser.providers.ipbtest;
			data = await api.createOAuthUser('github');
			githubUser = data.user;
			githubProfile = githubUser.providers.github;

			let res = await api.as('admin').markTeardown().post('/v1/tokens', {
				label: 'Auth test token',
				password: api.getUser('admin').password,
				provider: 'ipbtest', type: 'provider',
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
				.withHeader('X-User-Id', githubProfile.id)
				.get('/v1/user')
				.then(res => res.expectError(400, 'no user with id'));
		});

		it('should succeed with the correct provider user header', async () => {
			res = await api.withToken(appToken)
				.withHeader('X-User-Id', ipsProfile.id)
				.get('/v1/user')
				.then(res => res.expectStatus(200));
			expect(res.data.id).to.be(ipsUser.id);
		});

		it('should succeed with the correct vpdb user header', async () => {
			res = await api.withToken(appToken)
				.withHeader('X-Vpdb-User-Id', ipsUser.id)
				.get('/v1/user')
				.then(res => res.expectStatus(200));
			expect(res.data.id).to.be(ipsUser.id);
		});

		it('should be able to create an oauth user', async () => {
			res = await api.markRootTeardown()
				.withToken(appToken)
				.put('/v1/users', { provider_id: 1234, email: 'oauth@vpdb.io', username: 'oauthtest' })
				.then(res => res.expectStatus(201));
			expect(res.data.providers.ipbtest).to.be.ok();
		});
	});

	describe('when authorization is provided in the URL', () => {

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

		it('should fail if the token is a storage token', async () => {
			const path = '/api/v1/user';
			res = await api.as('member')
				.on('storage')
				.post('/v1/authenticate', { paths: path })
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data).to.have.key(path);

			await api.withQuery({ token: res.data[path] })
				.get('/v1/user')
				.then(res => res.expectError(401, 'invalid scope'));
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
					displayName: 'Motörhead-Dude&23',
					username: 'motorhead',
					profileUrl: 'https://github.com/mockuser',
					emails: [
						{ value: 'motorhead@vpdb.io' }
					],
					_raw: '(not mocked)', _json: { not: 'mocked '}
				}
			}).then(res => api.retrieveUserProfile(res));
			api.tearDownUser(profile.id);
			expect(profile.name).to.be('Motorhead-Dude23');
		});

		it('should match the same already registered Github user even though email and name are different', async () => {
			const profile1 = await api.createOAuthUser('github', { id: '65465', emails: [ 'mockuser@vpdb.io' ]});
			const profile2 = await api.createOAuthUser('github', { id: '65465', emails: [ 'other.email@vpdb.io' ]}, null, { teardown: false });
			expect(profile1.user.id).to.be(profile2.user.id);
		});

		it('should match an already registered local user with the same email address', async () => {
			const localUser = api.getUser('member');
			const oauthUser = await api.createOAuthUser('github', { id: '1234xyz', emails: [ localUser.email ]}, null, { teardown: false });
			expect(oauthUser.user.id).to.be(localUser.id);
		});

		it('should fail when no email value is provided via OAuth', async () => {
			const oauthUser = api.generateOAuthUser('github', { emails: [ { type: 'home' } ] });
			await api
				.post('/v1/authenticate/mock', oauthUser)
				.then(res => res.expectError(400, 'Emails must contain at least one value'));
		});

		it('should use email prefix when no user or display name is returned', async () => {
			const gen = api.generateUser();
			const oauthUser = {
				provider: 'github',
				profile: {
					provider: 'github',
					id: String(Math.floor(Math.random() * 100000)),
					profileUrl: 'https://github.com/bleh',
					emails: [ { value: gen.email } ]
				}
			};
			res = await api.markTeardown('user.id', '/v1/users')
				.post('/v1/authenticate/mock', oauthUser)
				.then(res => res.expectStatus(200));
			expect(res.data.user.name).to.be(gen.email.substr(0, gen.email.indexOf('@')).replace(/[^0-9a-z ]+/gi, ''));
		});

		it('should merge multiple accounts when matched', async () => {

			const localProfiles = [0, 1, 2].map(() => api.generateUser({ skipEmailConfirmation: true }));

			// register three different emails
			for (let localProfile of localProfiles) {
				res = await api
					.post('/v1/users', localProfile)
					.then(res => res.expectStatus(201));
				_.assign(localProfile, res.data);
			}

			// login with provider1/id1, who has registered email1/email2/email3 -> 3 accounts
			const oauthProfile = api.generateOAuthUser('github', { emails: localProfiles.map(p => p.email) });
			res = await api.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(409));

			expect(res.data.users).to.be.an('array');
			expect(res.data.users).to.have.length(3);

			// try again, this time indicate which user to merge to
			res = await api.markTeardown('user.id', '/v1/users')
				.withQuery({ merged_user_id: localProfiles[0].id })
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			expect(res.data.user.id).to.be(localProfiles[0].id);
			expect(res.data.user.emails).to.contain(localProfiles[1].email);
			expect(res.data.user.emails).to.contain(localProfiles[2].email);

			// make sure the other ones are gone
			await api.asRoot().get('/v1/users/' + localProfiles[1].id).then(res => res.expectError(404));
			await api.asRoot().get('/v1/users/' + localProfiles[2].id).then(res => res.expectError(404));
		});

		it('should merge when the oauth email changes to an existing address', async () => {

			const oauthProfile = api.generateOAuthUser('github');

			// 1. login with provider1/id1, email2 -> account1
			res = await api
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));
			const oauthUser = res.data.user;

			// 2. register locally with email2 -> account2
			const localUser = await api.createUser();

			// 3. change email1 at provider1/id1 to email2
			oauthProfile.profile.emails = [ { value: localUser.email } ];

			// 4. login with provider1/id1, email2 -> 2 accounts, one match by id1, one by email2
			res = await api.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(409));

			expect(res.data.users).to.be.an('array');
			expect(res.data.users).to.have.length(2);
			expect(res.data.users.map(u => u.id)).to.contain(localUser.id);
			expect(res.data.users.map(u => u.id)).to.contain(oauthUser.id);

			// try again with merge user id (merge oauth user into local user)
			res = await api.withQuery({ merged_user_id: localUser.id })
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			expect(res.data.user.id).to.be(localUser.id);

			// make sure the other ones is gone
			await api.asRoot().get('/v1/users/' + oauthUser.id).then(res => res.expectError(404));
		});

		it('should merge an existing user with a previously unconfirmed email', async () => {

			const dupeEmail = api.generateEmail();

			// 1. register locally with email1 -> account1
			const localUser = await api.createUser();

			// 2. change email1 to *unconfirmed* email2
			res = await api.as(localUser)
				.patch('/v1/user', { email: dupeEmail })
				.then(res => res.expectStatus(200));
			const emailToken = res.data.email_status.token;

			// 3. login at provider1/id1 with email2 -> account2
			const oauthUser = await api.createOAuthUser('github', { emails: [ dupeEmail ] }, null, { teardown: false });
			expect(oauthUser.user.id).not.to.be(localUser.id);

			// confirm email2 from mail => auto-merge
			res = await api.get('/v1/user/confirm/' + emailToken).then(res => res.expectStatus(200));
			expect(res.data.merged_users).to.be(1);
		});

		it('should merge a new user with a unconfirmed email', async () => {

			// register locally with *unconfirmed* email1 -> account1
			res = await api.post('/v1/users', api.generateUser({ returnEmailToken: true }))
				.then(res => res.expectStatus(201));
			const localUser = res.data;

			// login at provider1/id1 with email1 -> account2
			const oauth = await api.createOAuthUser('github', { emails: [ localUser.email ] });

			expect(oauth.user.id).not.to.be(localUser.id);

			// confirm email1 from mail => was auto-merged at login
			await api.get('/v1/user/confirm/' + localUser.email_token).then(res => res.expectError(404));
		});

		it('should update provider ID when changed between logins for same email', async () => {

			const oauthProfile = api.generateOAuthUser('github');

			// login with provider1/id1, email1 -> account1
			res = await api.markTeardown('user.id', '/v1/users')
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			const user = res.data.user;

			// at provider, create a second account with same email
			oauthProfile.profile.id += '0';

			// login with provider1/id2, email1 -> different provider id
			res = await api
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			// => update provider id
			expect(res.data.user.id).to.be(user.id);
			expect(res.data.user.providers.github.id).to.be(oauthProfile.profile.id);
		});

	});

	describe('when authenticating via IPS', () => {

		it('should create a new user and return the user profile along with a valid token', async () => {
			await api.markTeardown('user.id', '/v1/users').post('/v1/authenticate/mock', {
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
			res = await api.markTeardown('user.id', '/v1/users').post('/v1/authenticate/mock', githubUser)
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

	describe('when linking another account', () => {

		it('should fail when logged with the same provider but different id', async () => {
			// 1. login with provider1/id1, email1 -> account1
			const oauthUser1 = await api.createOAuthUser('github');
			// 2. link to provider1/id2 -> different provider id
			const oauthProfile2 = api.generateOAuthUser('github');
			await api
				.as(oauthUser1)
				.post('/v1/authenticate/mock', oauthProfile2)
				.then(res => res.expectError(400, 'is already linked to id'));
		});

		it('should fail when logged with the same provider but different id', async () => {
			// 1. login with provider1/id1, email1 -> account1
			const oauthUser1 = await api.createOAuthUser('github');
			// 2. link to provider1/id2 -> different provider id
			const oauthProfile2 = api.generateOAuthUser('github');
			await api
				.as(oauthUser1)
				.post('/v1/authenticate/mock', oauthProfile2)
				.then(res => res.expectError(400, 'is already linked to id'));
		});

		it('should auto-merge a local account when linking and account', async () => {
			// 1. register locally with email1 -> account1
			const user1 = await api.createUser();
			// 2. register locally with email2 -> account2
			const user2 = await api.createUser({}, { teardown: false });
			// 3. login with account2, link provider1/id1, email1 -> two accounts (one by match, one with currently logged).
			const oauthUser = api.generateOAuthUser('github', { emails: [ user2.email ] });
			res = await api
				.as(user1)
				.post('/v1/authenticate/mock', oauthUser)
				.then(res => res.expectStatus(200));
			expect(res.data.user.id).to.be(user1.id);
			expect(res.data.user.providers.github.id).to.be(oauthUser.profile.id);
			// make sure user2 is gone
			await api.asRoot().get('/v1/users/' + user2.id).then(res => res.expectStatus(404));
		});

		it('should auto-merge a local account when linking and account', async () => {
			// 1. login with provider1/id1, email1 -> account1
			const oauth = await api.createOAuthUser('ipbtest', {}, null, { teardown: false });
			// 2. register locally with email2 -> account2
			const localUser = await api.createUser();
			// 3. login with account2, link provider1/id1, email1 -> two accounts (one by match, one with currently logged).
			const linkedOAuth = api.generateOAuthUser('github', { emails: [ oauth.user.email ] });
			res = await api
				.as(localUser)
				.post('/v1/authenticate/mock', linkedOAuth)
				.then(res => res.expectStatus(200));
			expect(res.data.user.id).to.be(localUser.id);
			expect(res.data.user.providers.github.id).to.be(linkedOAuth.profile.id);
			expect(res.data.user.providers.ipbtest.id).to.be(oauth.user.providers.ipbtest.id);
			// make sure user2 is gone
			await api.asRoot().get('/v1/users/' + oauth.id).then(res => res.expectStatus(404));
		});

		it('should succeed without conflicted data', async() => {
			// 1. create local user
			const localUser = await api.createUser();
			expect(localUser.github).to.not.be.ok();
			// 2. link oauth account
			const oauthProfile = api.generateOAuthUser('github');
			res = await api
				.as(localUser)
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));
			expect(res.data.user.id).to.be(localUser.id);
			expect(res.data.user.providers.github).to.be.ok();
		});
	});

});
