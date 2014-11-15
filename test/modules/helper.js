"use strict";

var _ = require('lodash');
var util = require('util');
var async = require('async');
var debug = require('debug')('test-helper');
var faker = require('faker');
var randomstring = require('randomstring');
var expect = require('expect.js');

var superuser = '__superuser';

exports.auth = require('./auth-helper');
exports.file = require('./file-helper');
exports.game = require('./game-helper');
exports.release = require('./release-helper');

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

	var createUser = function(name, config) {
		return function(next) {
			var user = exports.genUser();

			// 1. create user
			debug('%s <%s>: Creating user...', name, user.email);
			request
				.post('/api/v1/users')
				.send(user)
				.end(function(err, res) {
					if (err) {
						return next(res && res.body ? res.body.error : err);
					}
					if (res.status !== 201) {
						return next(res.body ? res.body.error : res.body);
					}

					user = _.extend(user, res.body);
					that.users[name] = user;

					// 2. retrieve root user token
					debug('%s <%s>: Authenticating user...', name, user.email);
					request
						.post('/api/v1/authenticate')
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
							user = _.extend(user, config);
							request
								.put('/api/v1/users/' + user.id)
								.as(superuser)
								.send(_.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles' ]))
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

exports.genUser = function() {

	var username = '';
	do {
		username = faker.internet.userName().replace(/[^a-z0-9\._]+/gi, '');
	} while (username.length < 3);

	return {
		username: username,
		password: randomstring.generate(10),
		email: faker.internet.email().toLowerCase()
	};
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
				.del('/api/v1/users/' + that.users[name].id)
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

	if (this.doomedUsers) {
		users = users.concat(_.map(this.doomedUsers, function(userId) {
			return function(next) {
				request
					.del('/api/v1/users/' + userId)
					.as(superuser)
					.end(function(err, res) {
						if (err) {
							return next(err);
						}
						expect(res.status).to.eql(204);
						next();
					});
			};
		}));
	}

	async.series(users, function(err) {
		if (err) {
			throw new Error(err);
		}
		// lastly, delete super user.
		deleteUser(superuser, true)(function(err) {
			if (err) {
				throw new Error(err);
			}
			// reset local list
			that.users = {};
			that.doomedUsers = [];
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
 * Marks a release to be cleaned up in teardown.
 * @param user User with which the game was created
 * @param releaseId ID of the release
 */
exports.doomRelease = function(user, releaseId) {
	if (!this.doomedReleases) {
		this.doomedReleases = {};
	}
	if (!this.doomedReleases[user]) {
		this.doomedReleases[user] = [];
	}
	this.doomedReleases[user].unshift(releaseId);
};

/**
 * Marks a user to be cleaned up in teardown. Note that this is only for users
 * created in tests, the users in the before() method are cleaned automatically.
 * @param userId ID of the user
 */
exports.doomUser = function(userId) {
	if (!this.doomedUsers) {
		this.doomedUsers = [];
	}
	// only add if not already there.
	if (!~this.doomedUsers.indexOf(userId)) {
		this.doomedUsers.unshift(userId);
	}
};

/**
 * Cleans up files, games and users.
 *
 * @param request Superagent object
 * @param done Callback
 */
exports.cleanup = function(request, done) {

	var that = this;
	var doomedFiles = this.doomedFiles;
	var doomedGames = this.doomedGames;
	var doomedReleases = this.doomedReleases;

	async.series([

		// 1. cleanup files
		function(next) {
			if (!doomedFiles) {
				return next();
			}
			async.eachSeries(_.keys(doomedFiles), function(user, nextUser) {
				async.each(doomedFiles[user], function(fileId, next) {
					var req = request
						.del('/api/v1/files/' + fileId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(err);
							}
							if (res.status !== 204) {
								console.log(req.method + ' ' + req.url);
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextUser);

			}, function(err) {
				that.doomedFiles = {};
				next(err);
			});
		},

		// 2. cleanup releases
		function(next) {
			if (!doomedReleases) {
				return next();
			}
			async.eachSeries(_.keys(doomedReleases), function(user, nextRelease) {
				async.each(doomedReleases[user], function(releaseId, next) {
					request
						.del('/api/v1/releases/' + releaseId)
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
				}, nextRelease);

			}, function(err) {
				that.doomedReleases = {};
				next(err);
			});
		},

		// 3. cleanup games
		function(next) {
			if (!doomedGames) {
				return next();
			}
			async.eachSeries(_.keys(doomedGames), function(user, nextGame) {
				async.each(doomedGames[user], function(gameId, next) {
					request
						.del('/api/v1/games/' + gameId)
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

			}, function(err) {
				that.doomedGames = {};
				next(err);
			});
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
		expect(err).to.not.be.ok();
		if (res.status !== code) {
			console.warn(res.body);
		}
		expect(res.status).to.be(code);
		if (contains) {
			expect(res.body.error.message || res.body.error).to.contain(contains);
		}
		next(null, res.body);
	};
};

exports.expectStatus = function(err, res, code, contains) {
	if (res && res.status !== code) {
		console.log(res.body);
	}
	if (err) {
		console.log(err);
	}
	expect(err).to.not.be.ok();
	expect(res.status).to.be(code);
	if (contains) {
		expect(res.body.error).to.contain(contains);
	}
};

exports.expectValidationError = function(err, res, field, contains) {
	if (err) {
		console.log(err);
	}
	expect(err).to.not.be.ok();
	expect(res.status).to.be(422);
	expect(res.body.errors).to.be.an('array');
	var fieldErrors = _.filter(res.body.errors, { field: field });
	expect(fieldErrors.length).to.be.greaterThan(0);
	if (contains) {
		var matchedErrors = _.filter(fieldErrors, function(val) {
			return val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1;
		});
		expect(matchedErrors.length).to.be(1);
	}
};

exports.expectNoValidationError = function(err, res, field, contains) {
	if (err) {
		console.log(err);
	}
	expect(err).to.not.be.ok();
	if (_.isArray(res.body.errors)) {
		var fieldErrors = _.filter(res.body.errors, { field: field });
		if (contains) {
			var matchedErrors = _.filter(fieldErrors, function(val) {
				return val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1;
			});
			expect(matchedErrors.length).to.be(0);
		} else {
			expect(fieldErrors.length).to.be(0);
		}
	}
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
	console.log('         RESPONSE: %s', util.inspect(res.body ? res.body : res, null, 4, true));
};