var _ = require('underscore');
var faker = require('faker');
var randomstring = require('randomstring');
var expect = require('expect.js');

exports.setupUsers = function(request, roles, done) {

	this.users = {};
	request.tokens = {};

	var that = this;
	var genUser = function() {
		return {
			username: faker.Internet.userName(),
			password: randomstring.generate(10),
			email: faker.Internet.email().toLowerCase()
		};
	};
	var createUser = function(role) {
		return function(next) {
			var user = genUser();
			role = role || 'root';
			request
				.post('/users')
				.send(user)
				.end(function(err, res) {
					if (err) {
						return next(err);
					}
					expect(res.status).to.eql(201);

					user = _.extend(user, res.body);
					that.users[role] = user;

					// retrieve root user token
					request
						.post('/authenticate')
						.send(_.pick(user, 'username', 'password'))
						.end(function(err, res) {
							if (err) {
								return next(err);
							}
							expect(res.status).to.eql(200);
							request.tokens[role] = res.body.token;
							next();
						});
				});
		}
	};

	createUser('root')(done);
};

exports.teardownUsers = function(request, done) {
	var that = this;
	var deleteUser = function(role) {
		return function(next) {
			request
				.del('/users/' + that.users[role]._id)
				.as('root')
				.end(function(err, res) {
					if (err) {
						return next(err);
					}
					expect(res.status).to.eql(204);
					next();
				});
		}
	};

	deleteUser('root')(done);
};

exports.getUser = function(role) {
	return this.users[role];
}