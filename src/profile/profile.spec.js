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

const expect = require('expect.js');

const shortId = require('shortid32');
const faker = require('faker');
const randomString = require('randomstring');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../../test/modules/api.client');
const api = new ApiClient();
let res;

describe.only('The VPDB `profile` API', () => {

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

	describe('when fetching profile info', () => {

		it('should return detailed user data', async () => {
			const user = api.getUser('member');
			res = await api.as('member').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.email).to.be(user.email);
			expect(res.data.username).to.be(user.username);
			expect(res.data.roles).to.be.an('array');
			expect(res.data.permissions).to.be.an('object');
		});

		it('should return the user log', async () => {
			res = await api.as('member').get('/v1/profile/logs').then(res => res.expectStatus(200));
			expect(res.data).to.be.an('array');
			expect(res.data[0]).to.be.an('object');
			expect(res.data[0].event).to.be.ok();
			expect(res.data[0].payload).to.be.an('object');
			expect(res.data[0].ip).to.be.ok();
			expect(res.data[0].result).to.be.ok();
			expect(res.data[0].logged_at).to.be.ok();
		});
	});

	describe('when providing a valid authentication token', () => {

		it('should display the user profile', async () => {
			res = await api.as('root')
				.get('/v1/profile')
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
			await api.as('member').patch('/v1/profile', {}).then(res => res.expectStatus(200));
		});

		it('should succeed when updating all attributes', async () => {
			const user = await api.createUser();
			const name = faker.name.firstName() + ' ' + faker.name.lastName();
			const location = faker.address.city();
			const email = faker.internet.email().toLowerCase();
			const newPass = randomString.generate(10);
			await api.as(user)
				.save('user/update-profile')
				.patch('/v1/profile', {
					name: name,
					location: location,
					email: email,
					current_password: user.password,
					password: newPass
				})
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/profile').then(res => res.expectStatus(200));
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
				.patch('/v1/profile', { name: name })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as('member').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.name).to.be(name);
		});

		it('should fail when providing an empty name', async () => {
			await api.as('member')
				.patch('/v1/profile', { name: '' })
				.then(res => res.expectValidationError('name', 'must be provided'));
		});

		it('should fail when providing a null name', async () => {
			await api.as('member')
				.patch('/v1/profile', { name: null })
				.then(res => res.expectValidationError('name', 'must be provided'));
		});

		it('should fail when providing a too long name', async () => {
			await api.as('member')
				.patch('/v1/profile', { name: '012345678901234567890123456789-' })
				.then(res => res.expectValidationError('name', '30 characters'));
		});
	});

	describe('when a user updates its location', () => {

		it('should succeed when providing a valid location', async () => {
			const location = faker.address.city();
			await api.as('member')
				.patch('/v1/profile', { location: location })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as('member').get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.location).to.be(location);
		});

		it('should fail when providing an invalid location', async () => {
			const location = '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
			await api.as('member')
				.patch('/v1/profile', { location: location })
				.then(res => res.expectValidationError('location', 'must not be longer than 100 characters'));
		});

	});

	describe('when a user updates its preferences', () => {

		it('should fail when providing an empty table file name', async () => {
			await api.as('member')
				.patch('/v1/profile', { preferences: { tablefile_name: ' ' } })
				.then(res => res.expectValidationError('preferences.tablefile_name', 'must not be empty if set'));
		});

		it('should fail when providing a illegal table file name', async () => {
			await api.as('member')
				.patch('/v1/profile', { preferences: { tablefile_name: '*.fail' } })
				.then(res => res.expectValidationError('preferences.tablefile_name', 'valid windows filename'));
		});

		it('should succeed when providing a valid table file name', async () => {
			res = await api.as('chprofile')
				.patch('/v1/profile', { preferences: { tablefile_name: '{release_name}' } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.tablefile_name).to.be('{release_name}');
		});

		it('should fail when providing empty table file name flavor tags', async () => {
			await api.as('member')
				.patch('/v1/profile', { preferences: { flavor_tags: {} } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.lighting', 'must be provided'],
					['preferences.flavor_tags.orientation', 'must be provided']
				]));
		});

		it('should fail when providing empty table file name lighting flavor tags', async () => {
			await api.as('member')
				.patch('/v1/profile', { preferences: { flavor_tags: { lighting: {} } } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.lighting.day', 'must be provided'],
					['preferences.flavor_tags.lighting.night', 'must be provided']
				]));
		});

		it('should fail when providing empty table file name orientation flavor tags', async () => {
			await api.as('member')
				.patch('/v1/profile', { preferences: { flavor_tags: { orientation: {} } } })
				.then(res => res.expectValidationErrors([
					['preferences.flavor_tags.orientation.fs', 'must be provided'],
					['preferences.flavor_tags.orientation.ws', 'must be provided']
				]));
		});

		it('should succeed when providing empty fullscreen orientation flavor tag', async () => {
			res = await api.as('chprofile')
				.patch('/v1/profile', { preferences: { flavor_tags: { orientation: { fs: '', ws: 'dt', any: '' }, lighting: { day : '', night: 'nm', any: '' } } } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.flavor_tags.orientation.fs).to.be('');
		});

		it('should succeed when providing all flavor tags', async () => {
			res = await api.as('chprofile')
				.patch('/v1/profile', { preferences: { flavor_tags: { orientation: { fs: 'fs', ws: 'dt', any: 'universal' }, lighting: { day : 'day', night: 'nm', any: 'universal' } } } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.flavor_tags.orientation.fs).to.be('fs');
			expect(res.data.preferences.flavor_tags.orientation.ws).to.be('dt');
			expect(res.data.preferences.flavor_tags.lighting.day).to.be('day');
			expect(res.data.preferences.flavor_tags.lighting.night).to.be('nm');
		});

		it('should succeed when changing release moderation status notification', async () => {
			res = await api.as('chprofile')
				.patch('/v1/profile', { preferences: { notify_release_moderation_status: false } })
				.then(res => res.expectStatus(200));
			expect(res.data.preferences.notify_release_moderation_status).to.be(false);
		});

		it('should succeed when changing backglass moderation status notification', async () => {
			res = await api.as('chprofile')
				.patch('/v1/profile', { preferences: { notify_backglass_moderation_status: true } })
				.then(res => res.expectStatus(200));

			expect(res.data.preferences.notify_backglass_moderation_status).to.be(true);
		});
	});

	describe('when a user updates the channel config', () => {

		it('should fail for users with realtime features disabled', async () => {
			await api.as('member')
				.patch('/v1/profile', { channel_config: {} })
				.then(res => res.expectValidationError('channel_config', 'features are not enabled'));
		});

		it.skip('should fail when for non-existent releases', async () => {
			const user = await api.createUser({ _plan: 'vip' });
			await api.as(user)
				.patch('/v1/profile', { channel_config: { subscribed_releases: [ shortId(), '-invalid-' ] } })
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
				.patch('/v1/profile', { email: email })
				.then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/profile').then(res => res.expectStatus(200));

			expect(res.data.email).not.to.be(email);
			expect(res.data.email_status.code).to.be('pending_update');
			expect(res.data.email_status.value).to.be(email);
		});

		it('should succeed when providing a valid email and email is confirmed', async () => {
			const user = await api.createUser();
			const email = faker.internet.email().toLowerCase();
			res = await api.as(user)
				.patch('/v1/profile', { email: email, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			// confirm email token
			await api.save('user/confirm-token').get('/v1/profile/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// check updated value
			res = await api.as(user).get('/v1/profile').then(res => res.expectStatus(200));
			expect(res.data.email).to.be(email);
			expect(res.data.email_status).to.not.be.ok();
		});

		it('should succeed when providing the same email', async () => {
			await api.as('member')
				.patch('/v1/profile', { email: api.getUser('member').email })
				.then(res => res.expectStatus(200));
		});

		it('should fail when providing an invalid email', async () => {
			await api.as('member')
				.patch('/v1/profile', { email: 'noemail' })
				.then(res => res.expectValidationError('email', 'must be in the correct format'));
		});

		it('should fail when providing an email that already exists', async () => {
			await api.as('member')
				.patch('/v1/profile', { email: api.getUser('root').email })
				.then(res => res.expectValidationError('email', 'is already taken'));
		});

		it('should succeed when providing an email that already exists but is still pending', async () => {
			const user1 = await api.createUser();
			const user2 = await api.createUser();
			const email = faker.internet.email().toLowerCase();

			// change but don't confirm for user 1
			await api.as(user1)
				.patch('/v1/profile', { email: email })
				.then(res => res.expectStatus(200));

			// change but don't confirm for user 1
			await api.as(user2)
				.patch('/v1/profile', { email: email })
				.then(res => res.expectStatus(200));
		});

		it('should directly set the email status to confirmed if the email has already been confirmed in the past', async () => {
			const user = await api.createUser();
			const oldMail = user.email;
			const email1 = faker.internet.email().toLowerCase();
			const email2 = faker.internet.email().toLowerCase();

			// set email 1
			res = await api.as(user)
				.patch('/v1/profile', { email: email1, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			expect(res.data.email).to.be(oldMail);
			expect(res.data.email_status.code).to.be('pending_update');

			// confirm email token 1
			await api.get('/v1/profile/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// set email 2
			res = await api.as(user)
				.patch('/v1/profile', { email: email2, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			expect(res.data.email).to.be(email1);
			expect(res.data.email_status.code).to.be('pending_update');

			// confirm email token 2
			await api.get('/v1/profile/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// set email 1
			res = await api.as(user)
				.patch('/v1/profile', { email: email1, returnEmailToken: true })
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
					.patch('/v1/profile', { email: newEmail })
					.then(res => res.expectStatus(200));

				// set to old email
				res = await api.as('member')
					.patch('/v1/profile', { email: oldEmail })
					.then(res => res.expectStatus(200));
				expect(res.data.email).to.be(oldEmail);
				expect(res.data.email_status).to.not.be.ok();
			});

			it('should ignore the email when the submitted email is the same as the pending one', async () => {
				const user = await api.createUser();
				const newEmail = faker.internet.email().toLowerCase();
				// set to new email
				res = await api.as(user)
					.patch('/v1/profile', { email: newEmail })
					.then(res => res.expectStatus(200));

				const expiration = res.data.email_status.expires_at;

				// set to old email
				res = await api.as(user)
					.patch('/v1/profile', { email: newEmail })
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
					.patch('/v1/profile', { email: newEmail1 })
					.then(res => res.expectStatus(200));

				await api.as(user)
					.patch('/v1/profile', { email: newEmail2 })
					.then(res => res.expectValidationError('email', 'cannot update an email address that is still pending confirmation'));
			});
		});
	});

	describe('when a local user changes its password', () => {

		it('should fail if the current password is not provided', async () => {
			await api.as('member')
				.patch('/v1/profile', { password: 'yyy' })
				.then(res => res.expectValidationError('current_password', 'must provide your current password'));
		});

		it('should fail if the current password is invalid', async () => {
			await api.as('member')
				.patch('/v1/profile', { current_password: 'xxx', password: 'yyy' })
				.then(res => res.expectValidationError('current_password', 'invalid password'));
		});

		it('should fail if the new password is invalid', async () => {
			await api.as('member')
				.patch('/v1/profile', {
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
				.patch('/v1/profile',{ current_password: user.password, password: newPass })
				.then(res => res.expectStatus(200));

			await api.post('/v1/authenticate', { username: user.name, password: newPass })
				.then(res => res.expectStatus(200));
		});

		it('should deny authentication with the old password', async () => {
			const user = await api.createUser();
			const newPass = '12345678';
			await api.as(user)
				.patch('/v1/profile', { current_password: user.password, password: newPass })
				.then(res => res.expectStatus(200));
			await api.post('/v1/authenticate', { username: user.name, password: user.password })
				.then(res => res.expectError(401, 'Wrong username or password'));
		});
	});

	describe.skip('when a non-local user sets its username', () => {

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
				.patch('/v1/profile', { username: username, password: pass })
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
				.patch('/v1/profile', { username: oauth.user.name })
				.then(res => res.expectValidationError('password', 'must provide your new password'));
		});

		it('should fail when providing an invalid password', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');

			// 2. try setting local account
			await api.withToken(oauth.token)
				.patch('/v1/profile', { username: oauth.user.name, password: '123' })
				.then(res => res.expectValidationError('password', 'at least 6 characters'));
		});

		it('should fail the second time providing a different username', async () => {
			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			const username = api.generateUser().username;
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/profile', { username: username, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/profile', { username: "changedusername", password: pass })
				.then(res => res.expectValidationError('username', 'cannot change username'));
		});

		it('should succeed the second time providing the same username', async () => {

			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			const username = api.generateUser().username;
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/profile', { username: username, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/profile', { username: username, password: pass })
				.then(res => res.expectStatus(200));
		});
	});

});