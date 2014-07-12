var faker = require('faker');
var randomstring = require('randomstring');
var expect = require('expect.js');

exports.setupUsers = function(request, roles, done) {

	this.user = {
		username: faker.Internet.userName(),
		password: randomstring.generate(10),
		email: faker.Internet.email().toLowerCase()
	};

	var that = this;

	// create root user
	request
		.post('/users')
		.send(that.user)
		.end(function(err, res) {
			if (err) {
				return done(err);
			}
			expect(res.status).to.eql(201);
			that.user.id = res.body._id;

			// retrieve root user token
			request
				.post('/authenticate')
				.send(that.user)
				.end(function(err, res) {
					if (err) {
						return done(err);
					}
					expect(res.status).to.eql(200);
					request.tokens = { root: res.body.token };
					done();
				});
		});
};

exports.teardownUsers = function(request, done) {
	request
		.del('/users/' + this.user.id)
		.as('root')
		.end(function(err, res) {
			if (err) {
				return done(err);
			}
			expect(res.status).to.eql(204);
			done();
		});
};