var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request, {
	host: 'localhost',
	port: 3000,
	path: '/api'
});

describe('The VPDB API', function() {

	before(function(done) {
		hlp.setupUsers(request, {
			root: { roles: [ 'root' ]},
			admin: { roles: [ 'admin' ]},
			member: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	describe('for anonymous clients', function() {

		it('should deny access to user profile', function(done) {
			request
				.get('/user')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});

		it('should deny access to user list', function(done) {
			request
				.get('/users')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});


		it('should deny access to user update', function(done) {
			request
				.put('/users/1234567890abcdef')
				.end(function(err, res) {
					expect(res.status).to.be(401);
					done();
				});
		});


	});

});