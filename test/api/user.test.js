"use strict"; /*global describe, before, after, it*/

var _ = require('lodash');
var request = require('superagent');
var expect = require('expect.js');

var faker = require('faker');
var randomstring = require('randomstring');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('The VPDB `user` API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
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
			chprofile: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when listing all users', function() {

		it('the number of current users should be returned', function(done) {
			request
				.get('/api/v1/users')
				.as('admin')
				.save({ path: 'users/list' })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('array');
					expect(res.body).to.have.length(_.keys(hlp.users).length);
					done();
				});
		});
	});

	describe('when searching for a user', function() {

		describe('at least one user should be returned', function() {

			it('with full details as admin', function(done) {
				request
					.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
					.saveResponse({ path: 'users/search-as-admin' })
					.as('admin')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body).to.be.an('array');
						expect(res.body.length).to.be.greaterThan(0);
						expect(res.body[0]).to.have.property('email');
						done();
					});
			});

			it('with minimal infos as member', function(done) {
				request
					.get('/api/v1/users?q=' + hlp.getUser('member').name.substr(0, 3))
					.save({ path: 'users/search-as-member' })
					.as('member')
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body).to.be.an('array');
						expect(res.body.length).to.be.greaterThan(0);
						expect(res.body[0]).not.to.have.property('email');
						done();
					});
			});
		});
	});

	describe('when fetching a user', function() {

		it('should return full details', function(done) {
			var user = hlp.getUser('member');
			request
				.get('/api/v1/users/' + user.id)
				.save({ path: 'users/view' })
				.as('admin')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('object');
					expect(res.body.id).to.be(user.id);
					expect(res.body.name).to.be(user.name);
					expect(res.body.username).to.be(user.username);
					expect(res.body.email).to.be(user.email);
					expect(res.body.provider).to.be(user.provider);
					expect(res.body.roles).to.be.ok();
					done();
				});
		});

		it('should return minimal details', function(done) {
			var user = hlp.getUser('member');
			request
				.get('/api/v1/users/' + hlp.getUser('member').id)
				.as('chprofile')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('object');
					expect(res.body.id).to.be(user.id);
					expect(res.body.name).to.be(user.name);
					expect(res.body.username).to.be(user.username);
					expect(res.body.email).not.to.be.ok();
					expect(res.body.provider).not.to.be.ok();
					expect(res.body.roles).not.to.be.ok();
					done();
				});
		});
	});

	describe('when fetching profile info', function() {

		it('should return detailed user data', function(done) {
			request.get('/api/v1/user').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				var user = hlp.getUser('member');
				expect(res.body).to.be.an('object');
				expect(res.body.email).to.be(user.email);
				expect(res.body.username).to.be(user.username);
				expect(res.body.roles).to.be.an('array');
				expect(res.body.permissions).to.be.an('object');
				done();
			});
		});

		it('should return the user log', function(done) {
			request.get('/api/v1/user/logs').as('member').end(function(err, res) {
				hlp.expectStatus(err, res, 200);
				expect(res.body).to.be.an('array');
				expect(res.body[0]).to.be.an('object');
				expect(res.body[0].event).to.be.ok();
				expect(res.body[0].data).to.be.an('object');
				expect(res.body[0].ip).to.be.ok();
				expect(res.body[0].result).to.be.ok();
				expect(res.body[0].logged_at).to.be.ok();
				done();
			});
		});
	});

	describe('when a user registers', function() {

		it('should fail with invalid parameters', function(done) {
			request
				.post('/api/v1/users')
				.saveResponse({ path: 'users/post' })
				.send({
					username: 'x',
					password: 'xxx',
					email: 'xxx'
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 422);
					hlp.expectValidationError(err, res, 'email', 'email must be in the correct format');
					hlp.expectValidationError(err, res, 'username', 'length of username');
					hlp.expectValidationError(err, res, 'password', 'at least 6 characters');
					expect(res.body.errors).to.have.length(3);
					done();
				});
		});

		it('should fail retrieving an authentication token if email is unconfirmed', function(done) {
			var user = hlp.genUser();
			request
				.post('/api/v1/users')
				.save({ path: 'users/post' })
				.send(user)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomUser(res.body.id);

					// try to obtain auth token
					request.post('/api/v1/authenticate').send(_.pick(user, 'username', 'password')).end(hlp.status(401, 'account is inactive', done));
				});
		});

		it('should be able to retrieve an authentication token after email confirmation', function(done) {
			var user = hlp.genUser({ returnEmailToken: true });
			request
				.post('/api/v1/users')
				.send(user)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomUser(res.body.id);

					// confirm email token
					request.get('/api/v1/user/confirm/' + res.body.email_token).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						// try to obtain auth token
						request.post('/api/v1/authenticate').send(_.pick(user, 'username', 'password')).end(hlp.status(200, done));
					});

				});
		});

		it('should fail to confirm an email token a second time', function(done) {
			var user = hlp.genUser({ returnEmailToken: true });
			request
				.post('/api/v1/users')
				.send(user)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomUser(res.body.id);

					// confirm email token
					var confirmPath = '/api/v1/user/confirm/' + res.body.email_token;
					request.get(confirmPath).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						// try again
						request.get(confirmPath).end(hlp.status(404, done));
					});
				});
		});

		it('should fail to confirm an invalid email token', function(done) {

			request.get('/api/v1/user/confirm/invalid').saveResponse({ path: 'user/confirm-token' }).end(function(err, res) {
				hlp.expectStatus(err, res, 404, 'no such token');
				done();
			});
		});

	});

	describe('when providing a valid authentication token', function() {

		it('should display the user profile', function(done) {
			request
				.get('/api/v1/user')
				.as('root')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.email).to.eql(hlp.getUser('root').email);
					expect(res.body.name).to.eql(hlp.getUser('root').name);
					done();
				});
		});

		it('should return a token refresh header in any API response', function(done) {
			request
				.get('/api/v1/ping')
				.as('admin')
				.end(function(err, res) {
					expect(res.headers['x-token-refresh']).not.to.be.empty();
					done();
				});
		});
	});

	describe('when a user updates its profile', function() {

		it('should succeed when sending an empty object', function (done) {
			request.patch('/api/v1/user').as('member').send({}).end(hlp.status(200, done));
		});

		it('should succeed when updating all attributes', function(done) {
			var user = hlp.getUser('chpass3');
			var name = faker.name.firstName() + ' ' + faker.name.lastName();
			var location = faker.address.city();
			var email = faker.internet.email().toLowerCase();
			var newPass = randomstring.generate(10);
			request
				.patch('/api/v1/user')
				.as('chpass3')
				.save({ path: 'user/update-profile' })
				.send({
					name: name,
					location: location,
					email: email,
					current_password: user.password,
					password: newPass
				})
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);

					// check updated value
					request.get('/api/v1/user').as('chpass3').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.name).to.be(name);
						expect(res.body.location).to.be(location);
						expect(res.body.email_status.value).to.be(email);

						// check password change
						request
							.post('/api/v1/authenticate')
							.send({ username: user.name, password: newPass })
							.end(hlp.status(200, done));
					});
				});
		});

	});

	describe('when a user updates its name', function() {

		it('should succeed when providing a valid name', function (done) {
			var name = faker.name.firstName() + ' ' + faker.name.lastName();
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ name: name })
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);

					// check updated value
					request.get('/api/v1/user').as('member').end(function (err, res) {

						hlp.expectStatus(err, res, 200);
						expect(res.body.name).to.be(name);
						done();
					});
				});
		});

		it('should fail when providing an empty name', function (done) {
			var name = '';
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ name: name })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'name', 'must be provided');
					done();
				});
		});

		it('should fail when providing a null name', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ name: null })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'name', 'must be provided');
					done();
				});
		});

		it('should fail when providing a too long name', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ name: '012345678901234567890123456789-' })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'name', '30 characters');
					done();
				});
		});

	});

	describe('when a user updates its location', function() {

		it('should succeed when providing a valid location', function (done) {
				var location = faker.address.city();
				request
					.patch('/api/v1/user')
					.as('member')
					.send({ location: location })
					.end(function (err, res) {
						hlp.expectStatus(err, res, 200);

						// check updated value
						request.get('/api/v1/user').as('member').end(function (err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.location).to.be(location);
							done();
						});
					});
		});

		it('should fail when providing an invalid location', function (done) {
			var location = '01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ location: location })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'location', 'must not be longer than 100 characters');
					done();
				});
		});

	});

	describe('when a user updates its preferences', function() {

		it('should fail when providing an empty table file name', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ preferences: { tablefile_name: ' ' } })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'preferences.tablefile_name', 'must not be empty if set');
					done();
				});
		});

		it('should fail when providing a illegal table file name', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ preferences: { tablefile_name: '*.fail' } })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'preferences.tablefile_name', 'valid windows filename');
					done();
				});
		});

		it('should succeed when providing a valid table file name', function (done) {
			request
				.patch('/api/v1/user')
				.as('chprofile')
				.send({ preferences: { tablefile_name: '{release_name}' } })
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.preferences.tablefile_name).to.be('{release_name}');
					done();
				});
		});

		it('should fail when providing empty table file name flavor tags', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ preferences: { flavor_tags: {} } })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.lightning', 'must be provided');
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.orientation', 'must be provided');
					done();
				});
		});

		it('should fail when providing empty table file name lightning flavor tags', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ preferences: { flavor_tags: { lightning: {} } } })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.lightning.day', 'must be provided');
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.lightning.night', 'must be provided');
					done();
				});
		});

		it('should fail when providing empty table file name orientation flavor tags', function (done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ preferences: { flavor_tags: { orientation: {} } } })
				.end(function (err, res) {
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.orientation.fs', 'must be provided');
					hlp.expectValidationError(err, res, 'preferences.flavor_tags.orientation.ws', 'must be provided');
					done();
				});
		});

		it('should succeed when providing empty fullscreen orientation flavor tag', function (done) {
			request
				.patch('/api/v1/user')
				.as('chprofile')
				.send({ preferences: { flavor_tags: { orientation: { fs: '', ws: 'dt', any: '' }, lightning: { day : '', night: 'nm', any: '' } } } })
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.preferences.flavor_tags.orientation.fs).to.be('');
					done();
				});
		});

		it('should succeed when providing all flavor tags', function (done) {
			request
				.patch('/api/v1/user')
				.as('chprofile')
				.send({ preferences: { flavor_tags: { orientation: { fs: 'fs', ws: 'dt', any: 'universal' }, lightning: { day : 'day', night: 'nm', any: 'universal' } } } })
				.end(function (err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.preferences.flavor_tags.orientation.fs).to.be('fs');
					expect(res.body.preferences.flavor_tags.orientation.ws).to.be('dt');
					expect(res.body.preferences.flavor_tags.lightning.day).to.be('day');
					expect(res.body.preferences.flavor_tags.lightning.night).to.be('nm');
					done();
				});
		});

	});

	describe('when a user updates its email', function() {

		it('should fail when providing a valid email but email is unconfirmed', function(done) {
			var user = 'chmail1';
			var email = faker.internet.email().toLowerCase();
			request
				.patch('/api/v1/user')
				.as(user)
				.send({ email: email })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					// check updated value
					request.get('/api/v1/user').as(user).end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body.email).not.to.be(email);
						expect(res.body.email_status.code).to.be('pending_update');
						expect(res.body.email_status.value).to.be(email);
						done();
					});
				});
		});

		it('should succeed when providing a valid email and email is confirmed', function(done) {
			var user = 'chmail2';
			var email = faker.internet.email().toLowerCase();
			request
				.patch('/api/v1/user')
				.as(user)
				.send({ email: email, returnEmailToken: true })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					// confirm email token
					request.get('/api/v1/user/confirm/' + res.body.email_token).save({ path: 'user/confirm-token' }).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						// check updated value
						request.get('/api/v1/user').as(user).end(function(err, res) {
							hlp.expectStatus(err, res, 200);
							expect(res.body.email).to.be(email);
							expect(res.body.email_status).to.not.be.ok();
							done();
						});
					});
				});
		});

		it('should succeed when providing the same email', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ email: hlp.getUser('member').email })
				.end(hlp.status(200, done));
		});

		it('should fail when providing an invalid email', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ email: 'noemail' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'email', 'must be in the correct format');
					done();
				});
		});

		it('should fail when providing an email that already exists', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ email: hlp.getUser('root').email })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'email', 'is already taken');
					done();
				});
		});

		it('should fail when providing an email that already exists but is still pending', function(done) {

			var user1 = 'chmail6';
			var user2 = 'member';

			var email = faker.internet.email().toLowerCase();

			// change but don't confirm for user 1
			request
				.patch('/api/v1/user')
				.as(user1)
				.send({ email: email })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);

					// try to change for user 2
					request
						.patch('/api/v1/user')
						.as(user2)
						.send({ email: email })
						.end(function(err, res) {
							hlp.expectValidationError(err, res, 'email', 'already taken');
							done();
						});
				});
		});

		it('should directly set the email status to confirmed if the email has already been confirmed in the past', function(done) {

			var user = 'chmail5';
			var oldMail = hlp.getUser(user).email;
			var email1 = faker.internet.email().toLowerCase();
			var email2 = faker.internet.email().toLowerCase();

			// set email 1
			request
				.patch('/api/v1/user')
				.as(user)
				.send({ email: email1, returnEmailToken: true })
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body.email).to.be(oldMail);
					expect(res.body.email_status.code).to.be('pending_update');

					// confirm email token 1
					request.get('/api/v1/user/confirm/' + res.body.email_token).end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						// set email 2
						request
							.patch('/api/v1/user')
							.as(user)
							.send({ email: email2, returnEmailToken: true })
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.email).to.be(email1);
								expect(res.body.email_status.code).to.be('pending_update');

								// confirm email token 2
								request.get('/api/v1/user/confirm/' + res.body.email_token).end(function(err, res) {
									hlp.expectStatus(err, res, 200);

									// set email 1
									request
										.patch('/api/v1/user')
										.as(user)
										.send({ email: email1, returnEmailToken: true })
										.end(function(err, res) {
											hlp.expectStatus(err, res, 200);
											expect(res.body.email).to.be(email1);
											expect(res.body.email_status).to.not.be.ok();
											done();
										});
								});
							});
					});
				});
		});

		describe('when there is already a pending email update for that user', function() {

			it('should set back the email to confirmed when the submitted email is the same as the original one', function(done) {
				var oldEmail = hlp.getUser('member').email;
				var newEmail = faker.internet.email().toLowerCase();

				// set to new email
				request
					.patch('/api/v1/user')
					.as('member')
					.send({ email: newEmail })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						// set to old email
						request
							.patch('/api/v1/user')
							.as('member')
							.send({ email: oldEmail })
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.email).to.be(oldEmail);
								expect(res.body.email_status).to.not.be.ok();
								done();
							});
					});
			});

			it('should ignore the email when the submitted email is the same as the pending one', function(done) {
				var user = 'chmail3';
				var newEmail = faker.internet.email().toLowerCase();
				// set to new email
				request
					.patch('/api/v1/user')
					.as(user)
					.send({ email: newEmail })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						var expiration = res.body.email_status.expires_at;

						// set to old email
						request
							.patch('/api/v1/user')
							.as(user)
							.send({ email: newEmail })
							.end(function(err, res) {
								hlp.expectStatus(err, res, 200);
								expect(res.body.email).not.to.be(newEmail);
								expect(res.body.email_status.code).to.be('pending_update');
								expect(res.body.email_status.value).to.be(newEmail);
								expect(res.body.email_status.expires_at).to.be(expiration);
								done();
							});
					});
			});

			it('should fail when the submitted email is neither the current nor the pending one', function(done) {
				var user = 'chmail4';
				var newEmail1 = faker.internet.email().toLowerCase();
				var newEmail2 = faker.internet.email().toLowerCase();
				request
					.patch('/api/v1/user')
					.as(user)
					.send({ email: newEmail1 })
					.end(function(err, res) {
						hlp.expectStatus(err, res, 200);

						request
							.patch('/api/v1/user')
							.as(user)
							.send({ email: newEmail2 })
							.end(function(err, res) {
								hlp.expectValidationError(err, res, 'email', 'cannot update an email address that is still pending confirmation');
								done();
							});
					});
			});

		});

	});

	describe('when a local user changes its password', function() {

		it('should fail if the current password is not provided', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ password: 'yyy' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'current_password', 'must provide your current password');
					done();
				});
		});

		it('should fail if the current password is invalid', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({ current_password: 'xxx', password: 'yyy' })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'current_password', 'invalid password');
					done();
				});
		});

		it('should fail if the new password is invalid', function(done) {
			request
				.patch('/api/v1/user')
				.as('member')
				.send({
					current_password: hlp.getUser('member').password,
					password: 'xxx'
				})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'password', 'at least 6 characters');
					done();
				});
		});

		it('should grant authentication with the new password', function(done) {
			var user = hlp.getUser('chpass1');
			var newPass = randomstring.generate(10);
			request
				.patch('/api/v1/user')
				.as('chpass1')
				.send({ current_password: user.password, password: newPass })
				.saveRequest({ path: 'user/update-password' })
				.end(hlp.status(200, function() {
					request
						.post('/api/v1/authenticate')
						.send({ username: user.name, password: newPass })
						.end(hlp.status(200, done));
				}));
		});

		it('should deny authentication with the old password', function(done) {
			var user = hlp.getUser('chpass2');
			var newPass = '12345678';
			request
				.patch('/api/v1/user')
				.as('chpass2')
				.send({ current_password: user.password, password: newPass })
				.end(hlp.status(200, function() {
					request
						.post('/api/v1/authenticate')
						.send({ username: user.name, password: user.password })
						.end(hlp.status(401, 'Wrong username or password', done));
				}));
		});
	});

	describe('when a non-local user sets its username', function() {

		it('should succeed when providing a valid password', function(done) {

			// 1. create github user
			var gen = hlp.genGithubUser();
			request.post('/api/v1/authenticate/mock').send(gen).end(function(err, res) {

				hlp.expectStatus(err, res, 200);
				var user = res.body.user;
				var pass = randomstring.generate(10);
				var token = res.body.token;
				hlp.doomUser(user.id);
				expect(user.provider).to.be('github');

				// 2. add local credentials
				request
					.patch('/api/v1/user')
					.with(token)
					.saveRequest({ path: 'user/update-create-local' })
					.send({ username: gen.profile.username, password: pass })
					.end(hlp.status(200, function(err, user) {

						expect(user.provider).to.be('local');

						// 3. assert local credentials
						request
							.post('/api/v1/authenticate')
							.send({  username: gen.profile.username, password: pass })
							.end(hlp.status(200, done));
					}));
			});
		});

		it('should fail when providing no password', function(done) {

			// 1. create github user
			var gen = hlp.genGithubUser();
			request.post('/api/v1/authenticate/mock').send(gen).end(function(err, res) {

				hlp.expectStatus(err, res, 200);
				var user = res.body.user;
				var token = res.body.token;
				hlp.doomUser(user.id);

				// 2. try setting local account
				request
					.patch('/api/v1/user')
					.with(token)
					.send({ username: gen.profile.username })
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'password', 'must provide your new password');
						done();
					});
			});
		});

		it('should fail when providing an invalid password', function(done) {

			// 1. create github user
			var gen = hlp.genGithubUser();
			request.post('/api/v1/authenticate/mock').send(gen).end(function(err, res) {

				hlp.expectStatus(err, res, 200);
				var user = res.body.user;
				var token = res.body.token;
				hlp.doomUser(user.id);

				// 2. try setting local account
				request
					.patch('/api/v1/user')
					.with(token)
					.send({ username: gen.profile.username, password: '123' })
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'password', 'at least 6 characters');
						done();
					});
			});
		});

		it('should fail the second time providing a username', function(done) {

			// 1. create github user
			var gen = hlp.genGithubUser();
			request.post('/api/v1/authenticate/mock').send(gen).end(function(err, res) {

				hlp.expectStatus(err, res, 200);
				var user = res.body.user;
				var pass = randomstring.generate(10);
				var token = res.body.token;
				hlp.doomUser(user.id);

				// 2. add local credentials
				request
					.patch('/api/v1/user')
					.with(token)
					.send({ username: gen.profile.username, password: pass })
					.end(hlp.status(200, function() {

						// 3. add (again) local credentials
						request
							.patch('/api/v1/user')
							.with(token)
							.send({ username: gen.profile.username, password: pass })
							.end(function (err, res) {
								hlp.expectValidationError(err, res, 'username', 'cannot change username');
								done();
							});
					}));
			});
		});

	});

	describe('when an admin updates a user', function() {

		it('should work providing the minimal field set', function(done) {
			var changedUser = hlp.genUser();
			request
				.put('/api/v1/users/' + hlp.getUser('member').id)
				.save({ path: 'users/update' })
				.as('admin')
				.send({
					email: changedUser.email,
					username: changedUser.username,
					name: changedUser.username,
					is_active: true,
					roles: [ 'member' ]
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					request.get('/api/v1/users/' + hlp.getUser('member').id).as('admin').end(function(err, res) {
						hlp.expectStatus(err, res, 200);
						expect(res.body).to.be.an('object');
						expect(res.body.email).to.be(changedUser.email);
						expect(res.body.username).to.be(changedUser.username);
						done();
					});
				});
		});

		it('should fail if mandatory fields are missing', function(done) {
			request
				.put('/api/v1/users/' + hlp.getUser('member').id)
				.saveResponse({ path: 'users/update' })
				.as('admin')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'email', 'must be provided');
					hlp.expectValidationError(err, res, 'is_active', 'is required');
					hlp.expectValidationError(err, res, 'name', 'must be provided');
					hlp.expectValidationError(err, res, 'roles', 'is required');
					hlp.expectValidationError(err, res, 'username', 'must be between');
					expect(res.body.errors).to.have.length(5);
					done();
				});
		});

		it('should fail if read-only fields are provided', function(done) {
			var changedUser = hlp.genUser();
			request
				.put('/api/v1/users/' + hlp.getUser('member').id)
				.as('admin')
				.send({
					email: changedUser.email,
					username: changedUser.username,
					name: changedUser.username,
					is_active: true,
					roles: [ 'member' ],
					id: '123456789',
					provider: 'github',
					created_at: new Date(),
					gravatar_id: 'cca50395f5c76fe4aab0fa6657ec84a3'
				})
				.end(function(err, res) {
					expect(res.body.errors).to.have.length(4);
					hlp.expectValidationError(err, res, 'id', 'field is read-only');
					hlp.expectValidationError(err, res, 'provider', 'field is read-only');
					hlp.expectValidationError(err, res, 'created_at', 'field is read-only');
					hlp.expectValidationError(err, res, 'gravatar_id', 'field is read-only');
					done();
				});
		});

	});

});