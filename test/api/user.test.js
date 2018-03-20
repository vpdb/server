"use strict"; /*global describe, before, after, it*/

const _ = require('lodash');
const expect = require('expect.js');

const shortId = require('shortid32');
const faker = require('faker');
const randomString = require('randomstring');

shortId.characters('123456789abcdefghkmnopqrstuvwxyz');

const ApiClient = require('../modules/api.client');
const api = new ApiClient();
let res;

describe.only('The VPDB `user` API', () => {

	before(async () => {
		await api.setupUsers({
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
			contributor: { roles: [ 'contributor' ]},
			member: { roles: [ 'member' ]},
			chpass1: { roles: [ 'member' ]},
			chpass2: { roles: [ 'member' ]},
			chpass3: { roles: [ 'member' ]},
			chmail1: { roles: [ 'member' ]},
			chmail2: { roles: [ 'member' ]},
			chmail3: { roles: [ 'member' ]},
			chmail4: { roles: [ 'member' ]},
			chmail5: { roles: [ 'member' ]},
			chmail6: { roles: [ 'member' ]},
			chprofile: { roles: [ 'member' ]},
			addoauth: { roles: [ 'member' ]},
			vip: { roles: [ 'member' ], _plan: 'vip' },
			vip1: { roles: [ 'member' ], _plan: 'vip' }
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
			const user = api.getUser('member');
			res = await api.as('chprofile')
				.get('/v1/users/' + api.getUser('member').id)
				.then(res => res.expectStatus(200));
			expect(res.data).to.be.an('object');
			expect(res.data.id).to.be(user.id);
			expect(res.data.name).to.be(user.name);
			expect(res.data.username).to.be(user.username);
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
			const user = api.getUser('chpass3');
			const name = faker.name.firstName() + ' ' + faker.name.lastName();
			const location = faker.address.city();
			const email = faker.internet.email().toLowerCase();
			const newPass = randomString.generate(10);
			await api.as('chpass3')
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
			res = await api.as('chpass3').get('/v1/user').then(res => res.expectStatus(200));
			expect(res.data.name).to.be(name);
			expect(res.data.location).to.be(location);
			expect(res.data.email_status.value).to.be(email);

			// validate password change
			await api.post('/v1/authenticate', { username: user.name, password: newPass }).then(res => res.expectStatus(200));
		});

	});

	describe('when a user updates its name', () => {

		it('should succeed when providing a valid name', async () => {
			const name = faker.name.firstName() + ' ' + faker.name.lastName();
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
			await api.as('vip')
				.patch('/v1/user', { channel_config: { subscribed_releases: [ shortId(), '-invalid-' ] } })
				.then(res => res.expectValidationErrors([
					['channel_config.subscribed_releases.0', 'does not exist'],
					['channel_config.subscribed_releases.1', 'does not exist']
				]));
		});

		/*
		// testing success not possible because realtime api is disabled in test.
		it('should succeed for valid data', async () => {
			hlp.release.createRelease('contributor', await api, function(release) {
				await api
					.patch('/v1/user')
					.as('vip1')
					.send({ channel_config: {
						subscribed_releases: [ release.id ],
						subscribe_to_starred: true
					}})
					.end(hlp.status(200, function(err, user) {

						expect(user.channel_config.subscribed_releases).to.be.an('array');
						expect(user.channel_config.subscribed_releases).to.have.length(1);
						expect(user.channel_config.subscribed_releases[0]).to.be(release.id);
						expect(user.channel_config.subscribe_to_starred).to.be(true);
						done();
					}));
			});
		});*/

	});

	describe('when a user updates its email', () => {

		it('should fail when providing a valid email but email is unconfirmed', async () => {
			const user = 'chmail1';
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
			const user = 'chmail2';
			const email = faker.internet.email().toLowerCase();
			await api.as(user)
				.patch('/v1/user', { email: email, returnEmailToken: true })
				.then(res => res.expectStatus(200));

			// confirm email token
			await api.save('user/confirm-token').get('/v1/user/confirm/' + res.data.email_token).then(res => res.expectStatus(200));

			// check updated value
			await api.as(user).get('/v1/user').then(res => res.expectStatus(200));
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

		it('should fail when providing an email that already exists but is still pending', async () => {
			const user1 = 'chmail6';
			const user2 = 'member';
			const email = faker.internet.email().toLowerCase();

			// change but don't confirm for user 1
			await api.as(user1)
				.patch('/v1/user', { email: email })
				.then(res => res.expectStatus(200));

			// try to change for user 2
			await api.as(user2)
				.patch('/v1/user', { email: email })
				.then(res => res.expectValidationError('email', 'already taken'));
		});

		it('should directly set the email status to confirmed if the email has already been confirmed in the past', async () => {
			const user = 'chmail5';
			const oldMail = api.getUser(user).email;
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
				const user = 'chmail3';
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
				const user = 'chmail4';
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
			const user = api.getUser('chpass1');
			const newPass = randomString.generate(10);
			await api.as('chpass1')
				.saveRequest('user/update-password')
				.patch('/v1/user',{ current_password: user.password, password: newPass })
				.then(res => res.expectStatus(200));

			await api.post('/v1/authenticate', { username: user.name, password: newPass })
				.then(res => res.expectStatus(200));
		});

		it('should deny authentication with the old password', async () => {
			const user = api.getUser('chpass2');
			const newPass = '12345678';
			await api.as('chpass2')
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
			expect(oauth.user.provider).to.be('github');

			// 2. add local credentials
			const pass = randomString.generate(10);
			res = await api.saveResponse('user/update-create-local')
				.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name, password: pass })
				.then(res => res.expectStatus(200));
			expect(res.data.provider).to.be('local');

			// 3. assert local credentials
			await api.post('/v1/authenticate', { username: gen.profile.username, password: pass }).then(res => res.expectStatus(200));
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
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: "changedusername", password: pass })
				.then(res => res.expectValidationError('username', 'cannot change username'));
		});

		it('should succeed the second time providing the same username', async () => {

			// 1. create github user
			const oauth = await api.createOAuthUser('github');
			const pass = randomString.generate(10);

			// 2. add local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name, password: pass })
				.then(res => res.expectStatus(200));

			// 3. add (again) local credentials
			await api.withToken(oauth.token)
				.patch('/v1/user', { username: oauth.user.name, password: pass })
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
					['roles', 'is required'],
					['username', 'must be a string between'],
					['_plan', 'is required']
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
					type: 'application',
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
			res = await api.markTeardown()
				.withToken(appToken)
				.put('/v1/users', { email: 'by-isp@vpdb.io', username: 'böh', provider_id: 1234})
				.then(res => res.expectStatus(201));
			expect(res.data.ipbtest.id).to.be(1234);
			expect(res.data.email).to.be('by-isp@vpdb.io');
			expect(res.data.roles).to.eql([ 'member' ]);
		});

		it('should update a user with a known email address', async () => {
			res = await api.withToken(appToken)
				.put('/v1/users', { email: api.getUser('addoauth').email, username: 'böh', provider_id: 4321 })
				.then(res => res.expectStatus(200));
			expect(res.data.id).to.be(api.getUser('addoauth').id);
			expect(res.data.ipbtest.id).to.be(4321);
			expect(res.data.roles).to.eql(['member']);
		});

		it('should update a user with an existing provider ID', async () => {
			res = await api.markTeardown()
				.withToken(appToken)
				.put('/v1/users', { email: 'update-me@vpdb.io', username: 'duh', provider_id: 666 })
				.then(res => res.expectStatus(201));

			const user = res.data;
			await api.withToken(appToken)
				.put('/v1/users', { email: 'email-updated@vpdb.io', username: 'asdf', provider_id: 666 })
				.then(res => res.expectStatus(200));

			expect(res.data.id).to.be(user.id);
			expect(res.data.email).to.be('update-me@vpdb.io');
		});

	});

});