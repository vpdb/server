"use strict";

var _ = require('underscore');
var util = require('util');
var async = require('async');
var debug = require('debug')('test-helper');
var faker = require('faker');
var randomstring = require('randomstring');
var expect = require('expect.js');

var superuser = '__superuser';

/**
 * Sets up a bunch of users for a given test suite.
 *
 * @param request
 * @param config
 * @param done
 */
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
				.post('/api/users')
				.send(user)
				.end(function(err, res) {
					if (err) {
						return next(err.body ? err.body.error : err);
					}
					if (res.status !== 201) {
						return next(err.body ? err.body.error : err);
					}

					user = _.extend(user, res.body);
					that.users[name] = user;

					// 2. retrieve root user token
					debug('%s <%s>: Authenticating user...', name, user.email);
					request
						.post('/api/authenticate')
						.send(_.pick(user, 'username', 'password'))
						.end(function(err, res) {
							if (err) {
								return next(err.body.error);
							}
							if (res.status !== 200) {
								debug('%s <%s>: ERROR: %s', name, user.email, res.body.error);
								return next(res.body.error);
							}
							request.tokens[name] = res.body.token;

							// 3. update user
							debug('%s <%s>: Updating user...', name, user.email);
							user.roles = config.roles;
							request
								.put('/api/users/' + user.id)
								.as(superuser)
								.send(user)
								.end(function(err, res) {
									if (err) {
										return next(err.body.error);
									}
									if (res.status !== 200) {
										return next(res.body.error);
									}
									debug('%s <%s>: All good, next!', name, user.email);
									next();
								});
						});
				});
		};
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

/**
 * Removes previously created users.
 *
 * @param request Superagent object
 * @param done Callback
 */
exports.teardownUsers = function(request, done) {
	var that = this;
	var deleteUser = function(name, force) {
		return function(next) {
			// don't cut off the branch we're sitting on...
			if (!force && name === superuser) {
				return next();
			}
			request
				.del('/api/users/' + that.users[name].id)
				.as(superuser)
				.end(function(err, res) {
					if (err) {
						return next(err);
					}
					expect(res.status).to.eql(204);
					next();
				});
		};
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

/**
 * Marks a file to be cleaned up in teardown.
 * @param user User with which the file was created
 * @param fileId ID of the file
 */
exports.doomFile = function(user, fileId) {
	if (!this.doomedFiles) {
		this.doomedFiles = {};
	}
	if (!this.doomedFiles[user]) {
		this.doomedFiles[user] = [];
	}
	this.doomedFiles[user].unshift(fileId);
};

/**
 * Marks a game to be cleaned up in teardown.
 * @param user User with which the game was created
 * @param gameId ID of the game
 */
exports.doomGame = function(user, gameId) {
	if (!this.doomedGames) {
		this.doomedGames = {};
	}
	if (!this.doomedGames[user]) {
		this.doomedGames[user] = [];
	}
	this.doomedGames[user].unshift(gameId);
};

/**
 * Cleans up files, games and users.
 *
 * @param request Superagent object
 * @param done Callback
 */
exports.cleanup = function(request, done) {
	var doomedFiles = this.doomedFiles;
	var doomedGames = this.doomedGames;

	async.series([

		// 1. cleanup files
		function(next) {
			if (!doomedFiles) {
				return next();
			}
			async.eachSeries(_.keys(doomedFiles), function(user, nextUser) {
				async.each(doomedFiles[user], function(fileId, next) {
					request
						.del('/api/files/' + fileId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(err);
							}
							if (res.status !== 204) {
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextUser);
			}, next);
		},

		// 2. cleanup games
		function(next) {
			if (!doomedGames) {
				return next();
			}
			async.eachSeries(_.keys(doomedGames), function(user, nextGame) {
				async.each(doomedGames[user], function(gameId, next) {
					request
						.del('/api/games/' + gameId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(err);
							}
							if (res.status !== 204) {
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextGame);
			}, next);
		},

		// lastly, teardown users
		function(next) {
			exports.teardownUsers(request, next);
		}
	], done);
};

/**
 * Asserts that a response contains a given status code and no error
 * @param code Status code to assert
 * @param contains
 * @param [next=null] callback
 * @returns {Function} Function passed to end()
 */
exports.status = function(code, contains, next) {
	if (_.isFunction(contains)) {
		next = contains;
		contains = false;
	}
	return function(err, res) {
		expect(err).to.eql(null);
		if (res.status !== code) {
			console.warn(res.body);
		}
		expect(res.status).to.be(code);
		if (contains) {
			expect(res.body.error).to.contain(contains);
		}
		next();
	};
};

/**
 * Returns a user previously created with setupUsers();
 * @param name
 * @returns {*}
 */
exports.getUser = function(name) {
	return this.users[name];
};

exports.dump = function(res) {
	console.log('         RESPONSE: %s', util.inspect(res.body ? res.body : res, null, 2, true));
};