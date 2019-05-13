/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

"use strict"; /*global describe, before, after, it*/

const _ = require('lodash');
const expect = require('expect.js');

const shortId = require('shortid32');
shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/api.client');
const api = new ApiClient();
let res;

describe('The VPDB `user` API', () => {

	before(async () => {
		await api.setupUsers({
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
			contributor: { roles: [ 'contributor' ]},
			member: { roles: [ 'member' ]},
			chprofile: { roles: [ 'member' ]}
		});
	});

	after(async () => await api.teardown());

	describe('when listing all users', () => {

		it('the number of current users should be returned', async () => {

			res = await api.as('admin').save('users/list').get('/v1/users').then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data).to.have.length(api.numCreatedUsers());
		});
	});

	describe('when searching for a user', () => {

		describe('at least one user should be returned', () => {

			it('with full details as admin', async () => {
				res = await api.as('admin')
					.saveResponse('users/search-as-admin')
					.withQuery({ q: api.getUser('member').name.substr(0, 3) })
					.get('/v1/users')
					.then(res => res.expectStatus(200));

				expect(res.data).to.be.an('array');
				expect(res.data.length).to.be.greaterThan(0);
				expect(res.data[0]).to.have.property('email');
			});

			it('with minimal infos as member', async () => {
				res = await api.as('member')
					.withQuery({ q: api.getUser('member').name.substr(0, 3) })
					.get('/v1/users')
					.then(res => res.expectStatus(200));

				expect(res.data).to.be.an('array');
				expect(res.data.length).to.be.greaterThan(0);
				expect(res.data[0]).not.to.have.property('email');
			});
		});
	});

	describe('when fetching a user', () => {

		it('should return full details', async () => {
			const user = api.getUser('member');
			res = await api.as('admin')
				.save('users/view')
				.get('/v1/users/' + user.id)
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.id).to.be(user.id);
			expect(res.data.name).to.be(user.name);
			expect(res.data.username).to.be(user.username);
			expect(res.data.email).to.be(user.email);
			expect(res.data.provider).to.be(user.provider);
			expect(res.data.roles).to.be.ok();
		});

		it('should return minimal details', async () => {
			const member = api.getUser('member');
			const user = await api.createUser();
			res = await api.as(user)
				.get('/v1/users/' + member.id)
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.id).to.be(member.id);
			expect(res.data.name).to.be(member.name);
			expect(res.data.username).to.be(member.username);
			expect(res.data.email).not.to.be.ok();
			expect(res.data.provider).not.to.be.ok();
			expect(res.data.roles).not.to.be.ok();
		});
	});

	describe('when a user registers', () => {

		it('should fail with invalid parameters', async () => {
			await api.saveResponse('users/post')
				.post('/v1/users', {
					username: 'x',
					password: 'xxx',
					email: 'xxx'
				}).then(res => res.expectValidationErrors([
					['email', 'email must be in the correct format'],
					['username', 'must be between 3 and 30 characters'],
					['password', 'at least 6 characters']
				], 3));
		});

		it('should fail retrieving an authentication token if email is unconfirmed', async () => {
			const user = api.generateUser();
			await api.markTeardown()
				.save('users/post')
				.post('/v1/users', user)
				.then(res => res.expectStatus(201));

			// try to obtain auth token
			await api.post('/v1/authenticate', _.pick(user, 'username', 'password'))
				.then(res => res.expectError(403, 'account is inactive'));
		});

		it('should be able to retrieve an authentication token after email confirmation', async () => {
			const user = api.generateUser({ returnEmailToken: true });
			res = await api.markTeardown()
				.post('/v1/users', user)
				.then(res => res.expectStatus(201));

			// confirm email token
			await api.get('/v1/user/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// try to obtain auth token
			await api.post('/v1/authenticate', _.pick(user, 'username', 'password')).then(res => res.expectStatus(200));
		});

		it('should fail to confirm an email token a second time', async () => {
			const user = api.generateUser({ returnEmailToken: true });
			res = await api.markTeardown()
				.post('/v1/users', user)
				.then(res => res.expectStatus(201));

			// confirm email token
			const confirmPath = '/v1/user/confirm/' + res.data.email_token;
			await api.get(confirmPath).then(res => res.expectStatus(200));
			// try again
			await api.get(confirmPath).then(res => res.expectError(404));
		});

		it('should fail to confirm an invalid email token', async () => {
			await api.saveResponse('user/confirm-token')
				.get('/v1/user/confirm/invalid')
				.then(res => res.expectError(404, 'no such token'));
		});

		it('should fail if the same ip tried to login unsuccessfully before', async () => {

			// succeed first to clear previous counter
			await api
				.post('/v1/authenticate', { username: api.getUser('member').name, password: api.getUser('member').password })
				.then(res => res.expectStatus(200));

			// first, fail 10x to login
			for (let i = 0; i < 10; i++) {
				await api.post('/v1/authenticate', { username: 'xxx', password: 'xxx' }).then(res => res.expectError(401));
			}
			// now user creation should be blocked as well
			res = await api.post('/v1/users', {}).then(res => res.expectStatus(429));
			expect(res.data.wait).to.be(1);

			await new Promise(resolve => setTimeout(resolve, 1000));
		});

	});

	describe('when an admin updates a user', () => {

		it('should work providing the minimal field set', async () => {
			const changedUser = api.generateUser();
			await api.as('admin')
				.save('users/update')
				.put('/v1/users/' + api.getUser('member').id, {
					email: changedUser.email,
					username: changedUser.username,
					name: changedUser.username,
					is_active: true,
					roles: [ 'member' ],
					_plan: api.getUser('member').plan.id
				})
				.then(res => res.expectStatus(200));

			res = await api.as('admin').get('/v1/users/' + api.getUser('member').id).then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.email).to.be(changedUser.email);
			expect(res.data.username).to.be(changedUser.username);
		});

		it('should fail if mandatory fields are missing', async () => {
			await api.as('admin')
				.saveResponse('users/update')
				.put('/v1/users/' + api.getUser('member').id, {})
				.then(res => res.expectValidationErrors([
					['email', 'must be provided'],
					['name', 'must be provided'],
					['roles', 'must be provided'],
					['username', 'must be a string between'],
					['_plan', 'must be provided']
				], 6));
		});

		it('should fail if read-only fields are provided', async () => {
			const changedUser = api.generateUser();
			await api.as('admin')
				.put('/v1/users/' + api.getUser('member').id, {
					email: changedUser.email,
					username: changedUser.username,
					name: changedUser.username,
					is_active: true,
					roles: ['member'],
					id: '123456789',
					provider: 'github',
					created_at: new Date(),
					gravatar_id: 'cca50395f5c76fe4aab0fa6657ec84a3'
				})
				.then(res => res.expectValidationErrors([
					['id', 'field is read-only'],
					['provider', 'field is read-only'],
					['created_at', 'field is read-only'],
					['gravatar_id', 'field is read-only']
				]));
		});

	});

	describe('when a provider service creates a new user', () => {

		let appToken;
		before(async () => {
			res = await api.as('admin')
				.markTeardown()
				.post('/v1/tokens', {
					label: 'User test token',
					password: api.getUser('admin').password,
					provider: 'ipbtest',
					type: 'provider',
					scopes: ['community', 'service']
				})
				.then(res => res.expectStatus(201));
			appToken = res.data.token;
		});

		it('should fail with empty body', async () => {
			await api.withToken(appToken)
				.put('/v1/users', {})
				.then(res => res.expectValidationErrors([
					['email', 'email is required'],
					['username', 'username is required'],
					['provider_id', 'provider is required']
				]));
		});

		it('should fail with invalid body', async () => {
			await api.withToken(appToken)
				.put('/v1/users', {
					email: 'noemail',
					username: 'ö',
					provider_id: { test: 123 },
					provider_profile: 'string'
				})
				.then(res => res.expectValidationErrors([
					['email', 'email is invalid'],
					['username', 'must be alphanumeric'],
					['provider_id', 'must be a number or a string'],
					['provider_profile', 'must be an object']
				]));
		});

		it.skip('should add a new user with an unknown email address', async () => {
			res = await api.markRootTeardown()
				.withToken(appToken)
				.put('/v1/users', { email: 'by-isp@vpdb.io', username: 'böh', provider_id: 1234})
				.then(res => res.expectStatus(201));
			expect(res.data.providers.find(p => p.provider === 'ipbtest').id).to.be('1234');
			expect(res.data.email).to.be('by-isp@vpdb.io');
			expect(res.data.roles).to.eql([ 'member' ]);
		});

		it.skip('should update a user with a known email address', async () => {
			const user = await api.createUser();
			res = await api.withToken(appToken)
				.put('/v1/users', { email: user.email, username: 'böh', provider_id: 4321 })
				.then(res => res.expectStatus(200));
			expect(res.data.id).to.be(user.id);
			expect(res.data.providers.find(p => p.provider === 'ipbtest').id).to.be('4321');
			expect(res.data.roles).to.eql(['member']);
		});

		it('should update a user with an existing provider ID', async () => {
			res = await api.markRootTeardown()
				.withToken(appToken)
				.put('/v1/users', { email: 'update-me@vpdb.io', username: 'duh', provider_id: 666 })
				.then(res => res.expectStatus(201));

			const user = res.data;
			res = await api.withToken(appToken)
				.put('/v1/users', { email: 'email-updated@vpdb.io', username: 'asdf', provider_id: 666 })
				.then(res => res.expectStatus(200));

			expect(res.data.id).to.be(user.id);
			expect(res.data.email).to.be('update-me@vpdb.io');
		});

	});

	describe.skip('when authenticating with OAuth', () => {

	});

	describe.skip('when confirming the email address', () => {

		it('should merge an existing user with a previously unconfirmed email', async () => {
			const email = api.generateEmail();

			// 1. register locally with email1 -> account1
			const user1 = await api.createUser();

			// 2. register locally with email2 -> account2
			const user2 = await api.createUser({}, { teardown: false });

			// 3. change email1 to *unconfirmed* email3
			res = await api.as(user1).patch('/v1/user', { email: email }).then(res => res.expectStatus(200));
			const token1 = res.data.email_status.token;

			// 4. change email2 to *unconfirmed* email3
			res = await api.as(user2).patch('/v1/user', { email: email }).then(res => res.expectStatus(200));
			const token2 = res.data.email_status.token;

			// 5. confirm email3 at account1 -> still 2 accounts
			res = await api.get('/v1/user/confirm/' + token1).then(res => res.expectStatus(200));
			await api.asRoot().get('/v1/users/' + user2.id).then(res => res.expectStatus(200));

			// 6. confirm email3 at account2 -> conflict
			res = await api.get('/v1/user/confirm/' + token2).then(res => res.expectStatus(409));
			expect(res.data.data.users).to.be.an('array');
			expect(res.data.data.users).to.have.length(2);
			expect(res.data.data.users.map(u => u.id)).to.contain(user1.id);
			expect(res.data.data.users.map(u => u.id)).to.contain(user2.id);

			// try again, merge to account1
			res = await api.withQuery({ merged_user_id: user1.id })
				.get('/v1/user/confirm/' + token2).then(res => res.expectStatus(200));
			expect(res.data.merged_users).to.be(1);

			// make sure user2 is gone
			await api.asRoot().get('/v1/users/' + user2.id).then(res => res.expectStatus(404));
		});

		it('should merge an existing user when user was authenticated with OAuth during confirmation', async () => {

			// 1. register locally with email1, change to *unconfirmed* email2 -> account1
			const user1 = await api.createUser({}, { teardown: false });
			const user1b = api.generateUser();
			res = await api.as(user1)
				.patch('/v1/user', { email: user1b.email, returnEmailToken: true })
				.then(res => res.expectStatus(200));
			const user1token = res.data.email_status.token;

			// 2. register locally with email3, change to *unconfirmed* email4 -> account2
			const user2 = await api.createUser();
			const user2b = api.generateUser();
			res = await api.as(user2)
				.patch('/v1/user', { email: user2b.email, returnEmailToken: true })
				.then(res => res.expectStatus(200));
			const user2token = res.data.email_status.token;

			// 3. login at provider1/id1 with email2&email4 -> account3
			const oauthUser = await api.createOAuthUser('github', { emails: [ user1b.email, user2b.email ] }, null, { teardown: false });
			expect(oauthUser.user.id).not.to.be(user1.id);
			expect(oauthUser.user.id).not.to.be(user2.id);

			// 4. confirm email2 at account1 => auto-merge account3 into account1 (credentials are kept)
			await api.get('/v1/user/confirm/' + user1token).then(res => res.expectStatus(200));
			res = await api.post('/v1/authenticate', { username: user1.name, password: user1.password }).then(res => res.expectStatus(200));
			expect(res.data.user.id).to.be(user1.id);
			expect(res.data.user.providers.find(p => p.provider === 'github').id).to.be(oauthUser.user.providers.find(p => p.provider === 'github').id);
			await api.asRoot().get('/v1/users/' + oauthUser.user.id).then(res => res.expectStatus(404));

			// 5. confirm account2
			await api.get('/v1/user/confirm/' + user2token).then(res => res.expectStatus(409));
			// 	=> manual-merge account2 into account3 at confirmation
			res = await api.withQuery({ merged_user_id: user2.id })
				.get('/v1/user/confirm/' + user2token)
				.then(res => res.expectStatus(200));
			await api.post('/v1/authenticate', { username: user1.name, password: user1.password }).then(res => res.expectError(401, 'wrong username'));
			res = await api.post('/v1/authenticate', { username: user2.name, password: user2.password }).then(res => res.expectStatus(200));
			expect(res.data.user.id).to.be(user2.id);
			expect(res.data.user.name).to.be(user2.name);
			expect(res.data.user.providers.find(p => p.provider === 'github').id).to.be(oauthUser.user.providers.find(p => p.provider === 'github').id);
			expect(res.data.user.emails).to.contain(user1.email);
			expect(res.data.user.emails).to.contain(user2.email);
			expect(res.data.user.emails).to.contain(user1b.email);
			expect(res.data.user.emails).to.contain(user2b.email);
			await api.asRoot().get('/v1/users/' + user1.id).then(res => res.expectStatus(404));
		});
	});

});