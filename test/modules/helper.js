"use strict";

const Promise = require('bluebird');

var _ = require('lodash');
var util = require('util');
var async = require('async');
var debug = require('debug')('test-helper');
var faker = require('faker');
var objectPath = require("object-path");
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


	var users = _.map(config, function(config, name) {
		return exports._createUser(request, name, config);
	});

	// create super user first and then the rest
	exports._createUser(request, superuser, { roles: ['root', 'mocha' ] })(function(err) {
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

exports.genUser = function(attrs) {

	var username = '';
	do {
		username = faker.internet.userName().replace(/[^a-z0-9\._]+/gi, '');
	} while (username.length < 3);

	return _.extend({
		username: username,
		password: randomstring.generate(10),
		email: faker.internet.email().toLowerCase()
	}, attrs || {});
};

exports.genGithubUser = function() {
	var gen = exports.genUser();
	return {
		provider: 'github',
		profile: {
			provider: 'github',
			id: Math.floor(Math.random() * 100000),
			displayName: faker.name.firstName() + ' ' + faker.name.lastName(),
			username: gen.username,
			profileUrl: 'https://github.com/' + gen.username,
			emails: [
				{value: gen.email}
			]
		}
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

exports.storageToken = function(request, user, path, done) {
	request
		.post('/storage/v1/authenticate')
		.as(user)
		.send({ paths: path })
		.end(function(err, res) {
			exports.expectStatus(err, res, 200);
			expect(res.body).to.be.an('object');
			expect(res.body).to.have.key(path);
			done(res.body[path]);
		});
};

/**
 * Marks a file to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} fileId ID of the file
 */
exports.doomFile = function(user, fileId) {
	objectPath.ensureExists(this, "doomedFiles." + user, []);
	this.doomedFiles[user].unshift(fileId);
};

/**
 * Marks a game to be cleaned up in teardown.
 * @param {string} user User with which the game was created
 * @param {string} gameId ID of the game
 */
exports.doomGame = function(user, gameId) {
	objectPath.ensureExists(this, "doomedGames." + user, []);
	this.doomedGames[user].unshift(gameId);
};

/**
 * Marks a release to be cleaned up in teardown.
 * @param {string} user User with which the game was created
 * @param {string} releaseId ID of the release
 */
exports.doomRelease = function(user, releaseId) {
	objectPath.ensureExists(this, "doomedReleases." + user, []);
	this.doomedReleases[user].unshift(releaseId);
};

/**
 * Marks a tag to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} tagId ID of the tag
 */
exports.doomTag = function(user, tagId) {
	objectPath.ensureExists(this, "doomedTags." + user, []);
	this.doomedTags[user].unshift(tagId);
};

/**
 * Marks a build to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} buildId ID of the build
 */
exports.doomBuild = function(user, buildId) {
	objectPath.ensureExists(this, "doomedBuilds." + user, []);
	this.doomedBuilds[user].unshift(buildId);
};

/**
 * Marks a ROM to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} romId ID of the ROM
 */
exports.doomRom = function(user, romId) {
	objectPath.ensureExists(this, "doomedRoms." + user, []);
	this.doomedRoms[user].unshift(romId);
};

/**
 * Marks a ROM to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} tokenId ID of the ROM
 */
exports.doomToken = function(user, tokenId) {
	objectPath.ensureExists(this, "doomedTokens." + user, []);
	this.doomedTokens[user].unshift(tokenId);
};


/**
 * Marks a user to be cleaned up in teardown. Note that this is only for users
 * created in tests, the users in the before() method are cleaned automatically.
 * @param {string} userId ID of the user
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
	var doomedTags = this.doomedTags;
	var doomedBuilds = this.doomedBuilds;
	var doomedRoms = this.doomedRoms;
	var doomedTokens = this.doomedTokens;

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

		// 4. cleanup tags
		function(next) {
			if (!doomedTags) {
				return next();
			}
			async.eachSeries(_.keys(doomedTags), function(user, nextTag) {
				async.each(doomedTags[user], function(tagId, next) {
					request
						.del('/api/v1/tags/' + tagId)
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
				}, nextTag);

			}, function(err) {
				that.doomedTags = {};
				next(err);
			});
		},

		// 5. cleanup builds
		function(next) {
			if (!doomedBuilds) {
				return next();
			}
			async.eachSeries(_.keys(doomedBuilds), function(user, nextBuild) {
				async.each(doomedBuilds[user], function(buildId, next) {
					request
						.del('/api/v1/builds/' + buildId)
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
				}, nextBuild);

			}, function(err) {
				that.doomedBuilds = {};
				next(err);
			});
		},

		// 6. cleanup ROMs
		function(next) {
			if (!doomedRoms) {
				return next();
			}
			async.eachSeries(_.keys(doomedRoms), function(user, nextRom) {
				async.each(doomedRoms[user], function(romId, next) {
					request
						.del('/api/v1/roms/' + romId)
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
				}, nextRom);

			}, function(err) {
				that.doomedRoms = {};
				next(err);
			});
		},

		// 7. cleanup tokens
		function(next) {
			if (!doomedTokens) {
				return next();
			}
			async.eachSeries(_.keys(doomedTokens), function(user, nextToken) {
				async.each(nextToken[user], function(tokenId, next) {
					request
						.del('/api/v1/tokens/' + tokenId)
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
				}, nextToken);

			}, function(err) {
				that.doomedTokens = {};
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
 *
 * @param {int} code Status code to assert
 * @param {string|function} contains
 * @param {function} [next=null] callback
 * @returns {Function} Function passed to end()
 */
exports.status = function(code, contains, next) {
	if (_.isFunction(contains)) {
		next = contains;
		contains = false;
	}
	return function(err, res) {
		// if used as result of a promise, next is empty and err is not treated here.
		if (_.isUndefined(next)) {
			res = err.response;
			err = { status: res.status, response: res };
		}

		var status, body;
		if (code >= 200 && code < 300) {
			status = res.status;
			body = res.body;
			if (err) {
				throw new Error('Error in request: ' + err.message);
			}
		} else {
			status = err.status;
			body = err.response.body;
		}

		if (status !== code) {
			console.warn(body);
		}
		expect(status).to.be(code);
		if (contains) {
			var msg = body.error.message || body.error;
			expect(msg.toLowerCase()).to.contain(contains.toLowerCase());
		}
		if (next) {
			return next(null, body);
		}
		return Promise.resolve();
	};
};

exports.expectStatus = function(err, res, code, contains) {
	var status, body;

	// shift args if no error provided
	if (_.isNumber(res)) {
		contains = code;
		code = res;
		res = err;
		err = undefined;
	}
	if (code >= 200 && code < 300) {
		status = res.status;
		body = res.body;
		if (err) {
			exports.dump(err.response.body);
		}
		expect(err).to.not.be.ok();
	} else {
		status = err.status;
		body = err.response.body;
	}

	if (status !== code) {
		console.log(res.body);
	}

	expect(status).to.be(code);
	if (contains) {
		expect(body.error.toLowerCase()).to.contain(contains.toLowerCase());
	}
};

exports.expectValidationError = function(err, res, field, contains, code) {
	if (!err) {
		throw new Error('Expected validation error but got status ' + res.status + '.');
	}
	expect(err.status).to.be(code || 422);
	expect(err.response.body.errors).to.be.an('array');
	var fieldErrors = _.filter(err.response.body.errors, { field: field });
	if (!fieldErrors.length) {
		throw new Error('Expected validation error on field "' + field + '" but got none.');
	}
	if (contains) {
		var matchedErrors = _.filter(fieldErrors, function(val) {
			return val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1;
		});
		if (!matchedErrors.length) {
			throw new Error('Expected validation error on field "' + field + '" to contain "' + contains.toLowerCase() + '".');
		}
	}
};

exports.expectNoValidationError = function(err, res, field, contains) {
	if (_.isArray(err.response.body.errors)) {
		var fieldErrors = _.filter(err.response.body.errors, { field: field });
		if (contains) {
			var matchedErrors = _.filter(fieldErrors, function(val) {
				return val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1;
			});
			expect(matchedErrors.length).to.be(0);
		} else {
			if (fieldErrors.length !== 0) {
				throw new Error('Expected no validation errors on field "' + field + '" but got ' + fieldErrors.length + '.');
			}
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

exports.dump = function(res, title) {
	if (res.body) {
		console.log('%s (%d): %s', title || 'RESPONSE', res.status, util.inspect(res.body, null, null, true));
	} else {
		console.log('%s: %s', title || 'RESPONSE', util.inspect(res, null, null, true));
	}
};


exports._createUser = function(request, name, config) {
	var that = this;

	return function(next) {
		var user = exports.genUser();
		user.skipEmailConfirmation = true;

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
				that.users[name] = _.extend(user, { _plan: user.plan.id });

				// 2. retrieve root user token
				debug('%s <%s>: Authenticating user...', name, user.email);
				request
					.post('/api/v1/authenticate')
					.send(_.pick(user, 'username', 'password'))
					.end(function(err, res) {
						if (err) {
							return next(err);
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
							.send(_.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]))
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