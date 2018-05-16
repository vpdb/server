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

"use strict"; /*global describe, before, after, it*/

const _ = require('lodash');
const expect = require('expect.js');

const shortId = require('shortid32');
const faker = require('faker');
const randomString = require('randomstring');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const api = new ApiClient();
let res;

describe.only('The VPDB `user` API', () => {

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
					.saveResponse('users/search-as-admin')
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

	describe('when fetching profile info', () => {

		it('should return detailed user data', async () => {
			const user = api.getUser('member');
			res = await api.as('member').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.email).to.be(user.email);
			expect(res.data.username).to.be(user.username);
			expect(res.data.roles).to.be.an('array');
			expect(res.data.permissions).to.be.an('object');
		});

		it('should return the user log', async () => {
			res = await api.as('member').get('/v1/user/logs').then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data[0]).to.be.an('object');
			expect(res.data[0].event).to.be.ok();
			expect(res.data[0].payload).to.be.an('object');
			expect(res.data[0].ip).to.be.ok();
			expect(res.data[0].result).to.be.ok();
			expect(res.data[0].logged_at).to.be.ok();
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
	});

	describe('when providing a valid authentication token', () => {

		it('should display the user profile', async () => {
			res = await api.as('root')
				.get('/v1/user')
				.then(res => res.expectStatus(200));
			expect(res.data.email).to.eql(api.getUser('root').email);
			expect(res.data.name).to.eql(api.getUser('root').name);
		});

		it('should return a token refresh header in any API response', async () => {
			await api.as('admin')
				.get('/v1/ping')
				.then(res => res.expectHeader('x-token-refresh'))
		});
	});

	describe('when a user updates its profile', () => {

		it('should succeed when sending an empty object', async () => {
			await api.as('member').patch('/v1/user', {}).then(res => res.expectStatus(200));
		});

		it('should succeed when updating all attributes', async () => {
			const user = await api.createUser();
			const name = faker.name.firstName() + ' ' + faker.name.lastName();
			const location = faker.address.city();
			const email = faker.internet.email().toLowerCase();
			const newPass = randomString.generate(10);
			await api.as(user)
				.save('user/update-profile')
				.patch('/v1/user', {
					name: name,
					location: location,
					email: email,
					current_password: user.password,
					password: newPass
				})
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.name).to.be(name);
			expect(res.data.location).to.be(location);
			expect(res.data.email_status.value).to.be(email);

			// validate password change
			await api.post('/v1/authenticate', { username: user.name, password: newPass }).then(res => res.expectStatus(200));
		});

	});

	describe('when a user updates its name', () => {

		it('should succeed when providing a valid name', async () => {
			const name = faker.name.firstName().replace(/[^a-z0-9]+/i, '') + ' ' + faker.name.lastName().replace(/[^a-z0-9]+/i, '');
			await api.as('member')
				.patch('/v1/user', { name: name })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as('member').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.name).to.be(name);
		});

		it('should fail when providing an empty name', async () => {
			await api.as('member')
				.patch('/v1/user', { name: '' })
				.then(res => res.expectValidationError('name', 'must be provided'));
		});

		it('should fail when providing a null name', async () => {
			await api.as('member')
				.patch('/v1/user', { name: null })
				.then(res => res.expectValidationError('name', 'must be provided'));
		});

		it('should fail when providing a too long name', async () => {
			await api.as('member')
				.patch('/v1/user', { name: '012345678901234567890123456789-' })
				.then(res => res.expectValidationError('name', '30 characters'));
		});
	});

	describe('when a user updates its location', () => {

		it('should succeed when providing a valid location', async () => {
			const location = faker.address.city();
			await api.as('member')
				.patch('/v1/user', { location: location })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as('member').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.location).to.be(location);
		});

		it('should fail when providing an invalid location', async () => {
			const location = '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
			await api.as('member')
				.patch('/v1/user', { location: location })
				.then(res => res.expectValidationError('location', 'must not be longer than 100 characters'));
		});

	});

	describe('when a user updates its preferences', () => {

		it('should fail when providing an empty table file name', async () => {
			await api.as('member')
				.patch('/v1/user', { preferences: { tablefile_name: ' ' } })
				.then(res => res.expectValidationError('preferences.tablefile_name', 'must not be empty if set'));
		});

		it('should fail when providing a illegal table file name', async () => {
			await api.as('member')
				.patch('/v1/user', { preferences: { tablefile_name: '*.fail' } })
				.then(res => res.expectValidationError('preferences.tablefile_name', 'valid windows filename'));
		});

		it('should succeed when providing a valid table file name', async () => {
			res = await api.as('chprofile')
				.patch('/v1/user', { preferences: { tablefile_name: '{release_name}' } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.tablefile_name).to.be('{release_name}');
		});

		it('should fail when providing empty table file name flavor tags', async () => {
			await api.as('member')
				.patch('/v1/user', { preferences: { flavor_tags: {} } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.lighting', 'must be provided'],
					['preferences.flavor_tags.orientation', 'must be provided']
				]));
		});

		it('should fail when providing empty table file name lighting flavor tags', async () => {
			await api.as('member')
				.patch('/v1/user', { preferences: { flavor_tags: { lighting: {} } } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.lighting.day', 'must be provided'],
					['preferences.flavor_tags.lighting.night', 'must be provided']
				]));
		});

		it('should fail when providing empty table file name orientation flavor tags', async () => {
			await api.as('member')
				.patch('/v1/user', { preferences: { flavor_tags: { orientation: {} } } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.orientation.fs', 'must be provided'],
					['preferences.flavor_tags.orientation.ws', 'must be provided']
				]));
		});

		it('should succeed when providing empty fullscreen orientation flavor tag', async () => {
			res = await api.as('chprofile')
				.patch('/v1/user', { preferences: { flavor_tags: { orientation: { fs: '', ws: 'dt', any: '' }, lighting: { day : '', night: 'nm', any: '' } } } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.flavor_tags.orientation.fs).to.be('');
		});

		it('should succeed when providing all flavor tags', async () => {
			res = await api.as('chprofile')
				.patch('/v1/user', { preferences: { flavor_tags: { orientation: { fs: 'fs', ws: 'dt', any: 'universal' }, lighting: { day : 'day', night: 'nm', any: 'universal' } } } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.flavor_tags.orientation.fs).to.be('fs');
			expect(res.data.preferences.flavor_tags.orientation.ws).to.be('dt');
			expect(res.data.preferences.flavor_tags.lighting.day).to.be('day');
			expect(res.data.preferences.flavor_tags.lighting.night).to.be('nm');
		});

		it('should succeed when changing release moderation status notification', async () => {
			res = await api.as('chprofile')
				.patch('/v1/user', { preferences: { notify_release_moderation_status: false } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.notify_release_moderation_status).to.be(false);
		});

		it('should succeed when changing backglass moderation status notification', async () => {
			res = await api.as('chprofile')
				.patch('/v1/user', { preferences: { notify_backglass_moderation_status: true } })
				.then(res => res.expectStatus(200));

			expect(res.data.preferences.notify_backglass_moderation_status).to.be(true);
		});
	});

	describe('when a user updates the channel config', () => {

		it('should fail for users with realtime features disabled', async () => {
			await api.as('member')
				.patch('/v1/user', { channel_config: {} })
				.then(res => res.expectValidationError('channel_config', 'features are not enabled'));
		});

		it('should fail when for non-existent releases', async () => {
			const user = await api.createUser({ _plan: 'vip' });
			await api.as(user)
				.patch('/v1/user', { channel_config: { subscribed_releases: [ shortId(), '-invalid-' ] } })
				.then(res => res.expectValidationErrors([
					['channel_config.subscribed_releases.0', 'does not exist'],
					['channel_config.subscribed_releases.1', 'does not exist']
				]));
		});
	});

	describe('when a user updates its email', () => {

		it('should fail when providing a valid email but email is unconfirmed', async () => {
			const user = await api.createUser();
			const email = faker.internet.email().toLowerCase();
			await api.as(user)
				.patch('/v1/user', { email: email })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/user').then(res => res.expectStatus(200));

			expect(res.data.email).not.to.be(email);
			expect(res.data.email_status.code).to.be('pending_update');
			expect(res.data.email_status.value).to.be(email);
		});

		it('should succeed when providing a valid email and email is confirmed', async () => {
			const user = await api.createUser();
			const email = faker.internet.email().toLowerCase();
			res = await api.as(user)
				.patch('/v1/user', { email: email, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			// confirm email token
			await api.save('user/confirm-token').get('/v1/user/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.email).to.be(email);
			expect(res.data.email_status).to.not.be.ok();
		});

		it('should succeed when providing the same email', async () => {
			await api.as('member')
				.patch('/v1/user', { email: api.getUser('member').email })
				.then(res => res.expectStatus(200));
		});

		it('should fail when providing an invalid email', async () => {
			await api.as('member')
				.patch('/v1/user', { email: 'noemail' })
				.then(res => res.expectValidationError('email', 'must be in the correct format'));
		});

		it('should fail when providing an email that already exists', async () => {
			await api.as('member')
				.patch('/v1/user', { email: api.getUser('root').email })
				.then(res => res.expectValidationError('email', 'is already taken'));
		});

		it('should succeed when providing an email that already exists but is still pending', async () => {
			const user1 = await api.createUser();
			const user2 = await api.createUser();
			const email = faker.internet.email().toLowerCase();

			// change but don't confirm for user 1
			await api.as(user1)
				.patch('/v1/user', { email: email })
				.then(res => res.expectStatus(200));

			// change but don't confirm for user 1
			await api.as(user2)
				.patch('/v1/user', { email: email })
				.then(res => res.expectStatus(200));
		});

		it('should directly set the email status to confirmed if the email has already been confirmed in the past', async () => {
			const user = await api.createUser();
			const oldMail = user.email;
			const email1 = faker.internet.email().toLowerCase();
			const email2 = faker.internet.email().toLowerCase();

			// set email 1
			res = await api.as(user)
				.patch('/v1/user', { email: email1, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			expect(res.data.email).to.be(oldMail);
			expect(res.data.email_status.code).to.be('pending_update');

			// confirm email token 1
			await api.get('/v1/user/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// set email 2
			res = await api.as(user)
				.patch('/v1/user', { email: email2, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			expect(res.data.email).to.be(email1);
			expect(res.data.email_status.code).to.be('pending_update');

			// confirm email token 2
			await api.get('/v1/user/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// set email 1
			res = await api.as(user)
				.patch('/v1/user', { email: email1, returnEmailToken: true })
				.then(res => res.expectStatus(200));
			expect(res.data.email).to.be(email1);
			expect(res.data.email_status).to.not.be.ok();
		});

		describe('when there is already a pending email update for that user', () => {

			it('should set back the email to confirmed when the submitted email is the same as the original one', async () => {
				const oldEmail = api.getUser('member').email;
				const newEmail = faker.internet.email().toLowerCase();

				// set to new email
				await api.as('member')
					.patch('/v1/user', { email: newEmail })
					.then(res => res.expectStatus(200));

				// set to old email
				res = await api.as('member')
					.patch('/v1/user', { email: oldEmail })
					.then(res => res.expectStatus(200));
				expect(res.data.email).to.be(oldEmail);
				expect(res.data.email_status).to.not.be.ok();
			});

			it('should ignore the email when the submitted email is the same as the pending one', async () => {
				const user = await api.createUser();
				const newEmail = faker.internet.email().toLowerCase();
				// set to new email
				res = await api.as(user)
					.patch('/v1/user', { email: newEmail })
					.then(res => res.expectStatus(200));

				const expiration = res.data.email_status.expires_at;

				// set to old email
				res = await api.as(user)
					.patch('/v1/user', { email: newEmail })
					.then(res => res.expectStatus(200));
				expect(res.data.email).not.to.be(newEmail);
				expect(res.data.email_status.code).to.be('pending_update');
				expect(res.data.email_status.value).to.be(newEmail);
				expect(res.data.email_status.expires_at).to.be(expiration);
			});

			it('should fail when the submitted email is neither the current nor the pending one', async () => {
				const user = await api.createUser();
				const newEmail1 = faker.internet.email().toLowerCase();
				const newEmail2 = faker.internet.email().toLowerCase();
				await api.as(user)
					.patch('/v1/user', { email: newEmail1 })
					.then(res => res.expectStatus(200));

				await api.as(user)
					.patch('/v1/user', { email: newEmail2 })
					.then(res => res.expectValidationError('email', 'cannot update an email address that is still pending confirmation'));
			});
		});
	});

	describe('when a local user changes its password', () => {

		it('should fail if the current password is not provided', async () => {
			await api.as('member')
				.patch('/v1/user', { password: 'yyy' })
				.then(res => res.expectValidationError('current_password', 'must provide your current password'));
		});

		it('should fail if the current password is invalid', async () => {
			await api.as('member')
				.patch('/v1/user', { current_password: 'xxx', password: 'yyy' })
				.then(res => res.expectValidationError('current_password', 'invalid password'));
		});

		it('should fail if the new password is invalid', async () => {
			await api.as('member')
				.patch('/v1/user', {
					current_password: api.getUser('member').password,
					password: 'xxx'
				})
				.then(res => res.expectValidationError('password', 'at least 6 characters'));
		});

		it('should grant authentication with the new password', async () => {
			const user = await api.createUser();
			const newPass = randomString.generate(10);
			await api.as(user)
				.saveRequest('user/update-password')
				.patch('/v1/user',{ current_password: user.password, password: newPass })
				.then(res => res.expectStatus(200));

			await api.post('/v1/authenticate', { username: user.name, password: newPass })
				.then(res => res.expectStatus(200));
		});

		it('should deny authentication with the old password', async () => {
			const user = await api.createUser();
			const newPass = '12345678';
			await api.as(user)
				.patch('/v1/user', { current_password: user.password, password: newPass })
				.then(res => res.expectStatus(200));
			await api.post('/v1/authenticate', { username: user.name, password: user.password })
				.then(res => res.expectError(401, 'Wrong username or password'));
		});
	});

	describe('when a non-local user sets its username', () => {

		it('should succeed when providing a valid password', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			expect(oauth.user.is_local).to.be(false);
			expect(oauth.user.providers[0].provider).to.be('github');

			// 2. add local credentials
			const username = api.generateUser().username;
			const pass = randomString.generate(10);
			res = await api.saveResponse('user/update-create-local')
				.withToken(oauth.token)
				.patch('/v1/user', { username: username, password: pass })
				.then(res => res.expectStatus(200));
			expect(res.data.is_local).to.be(true);

			// 3. assert local credentials
			await api.post('/v1/authenticate', { username: username, password: pass }).then(res => res.expectStatus(200));
		});

		it('should fail when providing no password', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');

			// 2. try setting local account
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name })
				.then(res => res.expectValidationError('password', 'must provide your new password'));
		});

		it('should fail when providing an invalid password', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');

			// 2. try setting local account
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name, password: '123' })
				.then(res => res.expectValidationError('password', 'at least 6 characters'));
		});

		it('should fail the second time providing a different username', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			const username = api.generateUser().username;
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: username, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: "changedusername", password: pass })
				.then(res => res.expectValidationError('username', 'cannot change username'));
		});

		it('should succeed the second time providing the same username', async () => {

			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			const username = api.generateUser().username;
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: username, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: username, password: pass })
				.then(res => res.expectStatus(200));
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

		it('should add a new user with an unknown email address', async () => {
			res = await api.markRootTeardown()
				.withToken(appToken)
				.put('/v1/users', { email: 'by-isp@vpdb.io', username: 'böh', provider_id: 1234})
				.then(res => res.expectStatus(201));
			expect(res.data.providers.find(p => p.provider === 'ipbtest').id).to.be('1234');
			expect(res.data.email).to.be('by-isp@vpdb.io');
			expect(res.data.roles).to.eql([ 'member' ]);
		});

		it('should update a user with a known email address', async () => {
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

	describe('when authenticating with OAuth', () => {

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

			expect(res.data.data.users).to.be.an('array');
			expect(res.data.data.users).to.have.length(3);

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

			expect(res.data.data.users).to.be.an('array');
			expect(res.data.data.users).to.have.length(2);
			expect(res.data.data.users.map(u => u.id)).to.contain(localUser.id);
			expect(res.data.data.users.map(u => u.id)).to.contain(oauthUser.id);

			// try again with merge user id (merge oauth user into local user)
			res = await api.withQuery({ merged_user_id: localUser.id })
				.post('/v1/authenticate/mock', oauthProfile)
				.then(res => res.expectStatus(200));

			expect(res.data.user.id).to.be(localUser.id);

			// make sure the other ones is gone
			await api.asRoot().get('/v1/users/' + oauthUser.id).then(res => res.expectError(404));
		});

		it('should merge an existing user with a previously unconfirmed email', async () => {

			const dupeEmail = faker.internet.email().toLowerCase();

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
			expect(res.data.user.providers.find(p => p.provider === 'github').id).to.be(oauthProfile.profile.id);
		});

		it('should merge an existing user at confirmation when user was authenticated with OAuth during confirmation', async () => {

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
		})
	});

	describe('when authenticating locally', () => {

		it('should merge an existing user with a previously unconfirmed email', async () => {
			const email = faker.internet.email().toLowerCase();

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
			expect(res.data.user.providers.find(p => p.provider === 'github').id).to.be(oauthUser.profile.id);
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
			expect(res.data.user.providers.find(p => p.provider === 'github').id).to.be(linkedOAuth.profile.id);
			expect(res.data.user.providers.find(p => p.provider === 'ipbtest').id).to.be(oauth.user.providers.find(p => p.provider === 'ipbtest').id);
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
			expect(res.data.user.providers.find(p => p.provider === 'github')).to.be.ok();
		});
	});
});