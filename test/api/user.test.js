"use strict"; /*global describe, before, after, it*/

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

});