var request = require('superagent');
var expect = require('expect.js');
var faker = require('faker');
var randomstring = require('randomstring');
var superagentTest = require('../modules/superagent-test');

superagentTest(request, {
	host: 'localhost',
	port: 3000,
	path: '/api'
});

describe('The VPDB `user` API', function() {

	var auth = {};
	var user = {
		username: faker.Internet.userName(),
		password: randomstring.generate(10),
		email: faker.Internet.email().toLowerCase()
	};

	before(function(done) {

		// create root user
		request
			.post('/users')
			.send(user)
			.end(function(err, res) {
				if (err) {
					return done(err);
				}
				expect(res.status).to.eql(201);
				user.id = res.body._id;

				// retrieve root user token
				request
					.post('/authenticate')
					.send(user)
					.end(function(err, res) {
						if (err) {
							return done(err);
						}
						expect(res.status).to.eql(200);
						auth.root = 'Bearer ' + res.body.token;
						done();
					});
			});
	});

	after(function(done) {
		request
			.del('/users/' + user.id)
			.set('Authorization', auth.root)
			.end(function(err, res) {
				if (err) {
					return done(err);
				}
				expect(res.status).to.eql(204);
				done();
			});
	});

	it('should display the user profile', function(done) {
		request
			.get('/user')
			.set('Authorization', auth.root)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.eql(200);

				expect(res.body.email).to.eql(user.email);
				expect(res.body.name).to.eql(user.username);

				done();
			});
	});

});