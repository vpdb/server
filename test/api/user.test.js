var request = require('superagent');
var expect = require('expect.js');
var faker = require('faker');
var randomstring = require('randomstring');

describe('The VPDB `user` API', function() {

	var auth = {};
	var user = {
		username: faker.Internet.userName(),
		password: randomstring.generate(10),
		email: faker.Internet.email()
	};

	before(function(done) {
		// create root user
		request
			.post('http://localhost:3000/api/users')
			.send(user)
			.end(function(err, res) {
				if (err) {
					return done(err);
				}
				expect(res.status).to.eql(201);
				user.id = res.body._id;

				// retrieve root user token
				request
					.post('http://localhost:3000/api/authenticate')
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
			.del('http://localhost:3000/api/users/' + user.id)
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
			.get('http://localhost:3000/api/user')
			.set('Authorization', auth.root)
			.end(function(err, res) {
				expect(err).to.eql(null);
				expect(res.status).to.eql(200);
				done();
			});
	});

});