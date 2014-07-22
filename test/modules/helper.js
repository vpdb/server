var _ = require('underscore');
var async = require('async');
var debug = require('debug')('test-helper');
var faker = require('faker');
var randomstring = require('randomstring');
var expect = require('expect.js');

var superuser = '__superuser';

exports.setupUsers = function(request, config, done) {

	debug('Setting up %d user(s)...', _.keys(config).length);
	this.users = {};
	request.tokens = {};

	var that = this;
	var genUser = function() {
		return {
			username: faker.Internet.userName().replace(/[^a-z0-9\._]+/gi, ''),
			password: randomstring.generate(10),
			email: faker.Internet.email().toLowerCase()
		};
	};
	var createUser = function(name, config) {
		return function(next) {
			var user = genUser();


			// 1. create user
			debug('%s <%s>: Creating user...', name, user.email);
			request
				.post('/users')
				.send(user)
				.end(function(err, res) {
					if (err) {
						return next(err.body ? err.body.error : err);
					}
					if (res.status != 201) {
						return next(err.body ? err.body.error : err);
					}

					user = _.extend(user, res.body);
					that.users[name] = user;

					// 2. retrieve root user token
					debug('%s <%s>: Authenticating user...', name, user.email);
					request
						.post('/authenticate')
						.send(_.pick(user, 'username', 'password'))
						.end(function(err, res) {
							if (err) {
								return next(err.body.error);
							}
							if (res.status != 200) {
								debug('%s <%s>: ERROR: %s', name, user.email, res.body.error);
								return next(res.body.error);
							}
							request.tokens[name] = res.body.token;

							// 3. update user
							debug('%s <%s>: Updating user...', name, user.email);
							user.roles = config.roles;
							request
								.put('/users/' + user._id)
								.as(superuser)
								.send(user)
								.end(function(err, res) {
									if (err) {
										return next(err.body.error);
									}
									if (res.status != 200) {
										return next(res.body.error);
									}
									debug('%s <%s>: All good, next!', name, user.email);
									next();
								});
						});
				});
		}
	};

	var users = _.map(config, function(config, name) {
		return createUser(name, config);
	});

	// create super user first and then the rest
	createUser(superuser, { roles: ['root', 'mocha' ] })(function(err) {
		if (err) {
			throw new Error(err);
		}
		async.series(users, function(err) {
			if (err) {
				throw new Error(err);
			}
			done();
		});
	});

};

exports.teardownUsers = function(request, done) {
	var that = this;
	var deleteUser = function(name, force) {
		return function(next) {
			// don't cut off the branch we're sitting on...
			if (!force && name == superuser) {
				return next();
			}
			request
				.del('/users/' + that.users[name]._id)
				.as(superuser)
				.end(function(err, res) {
					if (err) {
						return next(err);
					}
					expect(res.status).to.eql(204);
					next();
				});
		}
	};

	var users = _.map(this.users, function(config, name) {
		return deleteUser(name);
	});

	async.series(users, function(err) {
		if (err) {
			throw new Error(err);
		}
		// lastly, delete super user.
		deleteUser(superuser, true)(function(err) {
			if (err) {
				throw new Error(err);
			}
			done();
		});
	});
};

exports.getUser = function(name) {
	return this.users[name];
}