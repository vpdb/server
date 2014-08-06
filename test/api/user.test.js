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
			member: { roles: [ 'member' ]}
		}, done);
	});

	after(function(done) {
		hlp.cleanup(request, done);
	});

	it('should display the user profile when logged', function(done) {
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

	it('should return a token refresh header when user changed', function(done) {
		request
			.get('/api/ping')
			.as('admin')
			.end(function(err, res) {
				expect(res.headers['x-token-refresh']).not.to.be.empty();
				done();
			});
	});

});