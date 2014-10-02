"use strict"; /*global describe, before, after, it*/

var _ = require('lodash');
var request = require('superagent');
var expect = require('expect.js');

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
			chpass2: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	describe('when listing all users', function() {

		it('the number of current users should be returned', function(done) {
			request
				.get('/api/users')
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
					.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
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
					.get('/api/users?q=' + hlp.getUser('member').name.substr(0, 3))
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
			request
				.get('/api/users/' + hlp.getUser('member').id)
				.save({ path: 'users/view' })
				.as('admin')
				.end(function(err, res) {
					hlp.expectStatus(err, res, 200);
					expect(res.body).to.be.an('object');
					done();
				});
		});
	});

	describe('when a user registrates', function() {

		it('should be able to retrieve an authentication token', function(done) {
			var user = hlp.genUser();
			request
				.post('/api/users')
				.save({ path: 'users/post' })
				.send(user)
				.end(function(err, res) {
					hlp.expectStatus(err, res, 201);
					hlp.doomUser(res.body.id);
					// try to obtain a token
					request.post('/api/authenticate').send(_.pick(user, 'username', 'password')).end(hlp.status(200, done));
				});
		});

		it('should fail when invalid parameters', function(done) {
			request
				.post('/api/users')
				.saveResponse({ path: 'users/post' })
				.send({
					username: 'x',
					password: 'xxx',
					email: 'xxx'
				}).end(function(err, res) {
					hlp.expectStatus(err, res, 422);
					expect(res.body.errors).to.be.an('array');
					expect(res.body.errors).to.have.length(3);
					done();
				});
		});
	});

	describe('when providing a valid authentication token', function() {

		it('should display the user profile', function(done) {
			request
				.get('/api/user')
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
				.get('/api/ping')
				.as('admin')
				.end(function(err, res) {
					expect(res.headers['x-token-refresh']).not.to.be.empty();
					done();
				});
		});
	});

	describe('when a local user changes its password', function() {

		it('should fail if the current password is not provided', function(done) {
			request
				.put('/api/user')
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401);
					expect(res.body.errors).to.be.an('array');
					expect(res.body.errors).to.have.length(1);
					expect(res.body.errors[0].field).to.be('currentPassword');
					expect(res.body.errors[0].message).to.contain('must provide your current password');
					done();
				});
		});

		it('should fail if the current password is invalid', function(done) {
			request
				.put('/api/user')
				.as('member')
				.send({ currentPassword: 'xxx'})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 401);
					expect(res.body.errors).to.be.an('array');
					expect(res.body.errors).to.have.length(1);
					expect(res.body.errors[0].field).to.be('currentPassword');
					expect(res.body.errors[0].message).to.contain('Invalid password');
					done();
				});
		});

		it('should fail if the new password is invalid', function(done) {
			request
				.put('/api/user')
				.as('member')
				.send({
					currentPassword: hlp.getUser('member').password,
					password: 'xxx'
				})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 422);
					expect(res.body.errors).to.be.an('array');
					expect(res.body.errors).to.have.length(1);
					expect(res.body.errors[0].field).to.be('password');
					expect(res.body.errors[0].message).to.contain('at least 6 characters');
					done();
				});
		});

		it('should grant authentication with the new password', function(done) {
			var user = hlp.getUser('chpass1');
			var newPass = '12345678';
			request
				.put('/api/user')
				.as('chpass1')
				.send({ currentPassword: user.password, password: newPass })
				.end(hlp.status(200, function() {
					request
						.post('/api/authenticate')
						.send({ username: user.name, password: newPass })
						.end(hlp.status(200, done));
				}));
		});

		it('should deny authentication with old password', function(done) {
			var user = hlp.getUser('chpass2');
			var newPass = '12345678';
			request
				.put('/api/user')
				.as('chpass2')
				.send({ currentPassword: user.password, password: newPass })
				.end(hlp.status(200, function() {
					request
						.post('/api/authenticate')
						.send({ username: user.name, password: user.password })
						.end(hlp.status(401, 'Wrong username or password', done));
				}));
		});
	});

	describe('when a non-local user sets its password', function() {

		it('should succeed without providing a current password');
		it('should fail the second time without providng a current password');
	});

	describe('when an admin updates a user', function() {

		it('should work providing the minimal field set', function(done) {
			var changedUser = hlp.genUser();
			request
				.put('/api/users/' + hlp.getUser('member').id)
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
					request.get('/api/users/' + hlp.getUser('member').id).as('admin').end(function(err, res) {
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
				.put('/api/users/' + hlp.getUser('member').id)
				.saveResponse({ path: 'users/update' })
				.as('admin')
				.send({})
				.end(function(err, res) {
					hlp.expectStatus(err, res, 422);
					expect(res.body).to.be.an('object');
					expect(res.body).to.have.property('errors');
					expect(res.body.errors).to.have.length(5);
					done();
				});
		});

		it('should fail if read-only fields are provided', function(done) {
			var changedUser = hlp.genUser();
			request
				.put('/api/users/' + hlp.getUser('member').id)
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
					hlp.expectStatus(err, res, 422);
					expect(res.body).to.be.an('object');
					expect(res.body).to.have.property('errors');
					expect(res.body.errors).to.have.length(4);
					done();
				});
		});
	});

});