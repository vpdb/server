var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request, {
	host: 'localhost',
	port: 3000,
	path: '/api'
});

describe('The VPDB `user` API', function() {

	before(function(done) {
		hlp.setupUsers(request, ['root', 'member'], done);
	});

	after(function(done) {
		hlp.teardownUsers(request, done);
	});

	it('should display the user profile', function(done) {
		request
			.get('/user')
			.as('root')
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.eql(200);

//				expect(res.body.email).to.eql(user.email);
//				expect(res.body.name).to.eql(user.username);

				done();
			});
	});

});