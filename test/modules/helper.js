"use strict";

Promise = require('bluebird'); // jshint ignore:line

const _ = require('lodash');
const util = require('util');
const async = require('async');
const debug = require('debug')('test-helper');
const faker = require('faker');
const randomstring = require('randomstring');
const expect = require('expect.js');
const parseUrl = require('url').parse;

const superuser = '__superuser';

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

	const users = _.map(config, function(config, name) {
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

	let username = '';
	do {
		username = faker.internet.userName().replace(/[^a-z0-9]+/gi, '');
	} while (username.length < 3);

	return _.extend({
		username: username,
		password: randomstring.generate(10),
		email: faker.internet.email(faker.name.firstName(), faker.name.lastName(), faker.internet.domainName()).replace('_', '.')
	}, attrs || {});
};

exports.genGithubUser = function() {
	const gen = exports.genUser();
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
	const that = this;
	const deleteUser = function(name, force) {
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
						return next(appendError(err, res));
					}
					expect(res.status).to.eql(204);
					next();
				});
		};
	};

	let users = _.map(this.users, function(config, name) {
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
							return next(appendError(err, res));
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
	this.ensureExists("doomedFiles", user);
	this.doomedFiles[user].unshift(fileId);
};

/**
 * Marks a game to be cleaned up in teardown.
 * @param {string} user User with which the game was created
 * @param {string} gameId ID of the game
 */
exports.doomGame = function(user, gameId) {
	this.ensureExists("doomedGames", user);
	this.doomedGames[user].unshift(gameId);
};

/**
 * Marks a release to be cleaned up in teardown.
 * @param {string} user User with which the game was created
 * @param {string} releaseId ID of the release
 */
exports.doomRelease = function(user, releaseId) {
	this.ensureExists("doomedReleases", user);
	this.doomedReleases[user].unshift(releaseId);
};

/**
 * Marks a tag to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} tagId ID of the tag
 */
exports.doomTag = function(user, tagId) {
	this.ensureExists("doomedTags", user);
	this.doomedTags[user].unshift(tagId);
};

/**
 * Marks a build to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} buildId ID of the build
 */
exports.doomBuild = function(user, buildId) {
	this.ensureExists("doomedBuilds", user);
	this.doomedBuilds[user].unshift(buildId);
};

/**
 * Marks a ROM to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} romId ID of the ROM
 */
exports.doomRom = function(user, romId) {
	this.ensureExists("doomedRoms", user);
	this.doomedRoms[user].unshift(romId);
};

/**
 * Marks a backglass to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} backglassId ID of the backglass
 */
exports.doomBackglass = function(user, backglassId) {
	this.ensureExists("doomedBackglasses", user);
	this.doomedBackglasses[user].unshift(backglassId);
};

/**
 * Marks a medium to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} mediumId ID of the medium
 */
exports.doomMedium = function(user, mediumId) {
	this.ensureExists("doomedMedia", user);
	this.doomedMedia[user].unshift(mediumId);
};

/**
 * Marks a game request to be cleaned up in teardown.
 * @param {string} user User with which the file was created
 * @param {string} gameRequestId ID of the game request
 */
exports.doomGameRequest = function(user, gameRequestId) {
	this.ensureExists("doomedGameRequests", user);
	this.doomedGameRequests[user].unshift(gameRequestId);
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

exports.ensureExists = function(attr, user) {
	if (!_.isObject(this[attr])) {
		this[attr] = {};
	}
	if (!_.isArray(this[attr][user])) {
		this[attr][user] = [];
	}
};

/**
 * Cleans up files, games and users.
 *
 * @param request Superagent object
 * @param done Callback
 */
exports.cleanup = function(request, done) {

	const that = this;
	let doomedFiles = this.doomedFiles;
	let doomedGames = this.doomedGames;
	let doomedReleases = this.doomedReleases;
	let doomedTags = this.doomedTags;
	let doomedBuilds = this.doomedBuilds;
	let doomedRoms = this.doomedRoms;
	let doomedBackglasses = this.doomedBackglasses;
	let doomedMedia = this.doomedMedia;
	let doomedGameRequests = this.doomedGameRequests;

	async.series([

		// 1. cleanup files
		function(next) {
			if (!doomedFiles) {
				return next();
			}
			async.eachSeries(_.keys(doomedFiles), function(user, nextUser) {
				async.each(doomedFiles[user], function(fileId, next) {
					const req = request
						.del('/api/v1/files/' + fileId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(appendError(err, res));
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
								return next(appendError(err, res));
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

		// 3. cleanup tags
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
								return next(appendError(err, res));
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

		// 4. cleanup builds
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
								return next(appendError(err, res));
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

		// 5. cleanup ROMs
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
								return next(appendError(err, res));
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

		// 6. cleanup backglasses
		function(next) {
			if (!doomedBackglasses) {
				return next();
			}
			async.eachSeries(_.keys(doomedBackglasses), function(user, nextBackglass) {
				async.each(doomedBackglasses[user], function(backglassId, next) {
					request
						.del('/api/v1/backglasses/' + backglassId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(appendError(err, res));
							}
							if (res.status !== 204) {
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextBackglass);

			}, function(err) {
				that.doomedBackglasses = {};
				next(err);
			});
		},

		// 7. cleanup media
		function(next) {
			if (!doomedMedia) {
				return next();
			}
			async.eachSeries(_.keys(doomedMedia), function(user, nextMedium) {
				async.each(doomedMedia[user], function(mediumId, next) {
					request
						.del('/api/v1/media/' + mediumId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(appendError(err, res));
							}
							if (res.status !== 204) {
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextMedium);

			}, function(err) {
				that.doomedMedia = {};
				next(err);
			});
		},

		// 7. cleanup game requests
		function(next) {
			if (!doomedGameRequests) {
				return next();
			}
			async.eachSeries(_.keys(doomedGameRequests), function(user, nextGameRequest) {
				async.each(doomedGameRequests[user], function(gameRequestId, next) {
					request
						.del('/api/v1/game_requests/' + gameRequestId)
						.as(user)
						.end(function(err, res) {
							if (err) {
								return next(appendError(err, res));
							}
							if (res.status !== 204) {
								console.log(res.body);
							}
							expect(res.status).to.eql(204);
							next();
						});
				}, nextGameRequest);

			}, function(err) {
				that.doomedGameRequests = {};
				next(err);
			});
		},

		// 8. cleanup games
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
								console.error(res.body);
								return next(appendError(err, res));
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
 *
 * @param {int} code Status code to assert
 * @param {string|function} [contains]
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

		const status = err ? err.status : res.status;
		const body = err ? err.response.body : res.body;

		if (status !== code) {
			console.warn("RESPONSE BODY = %j", body);
		}
		expect(status).to.be(code);
		if (contains) {
			if (!body.error) {
				exports.dump(body);
				throw new Error('Expected error message but got no error.');
			}
			const msg = body.error.message || body.error;
			expect(msg.toLowerCase()).to.contain(contains.toLowerCase());
		}
		if (next) {
			return next(null, body);
		}
		return Promise.resolve();
	};
};

exports.expectStatus = function(err, res, code, contains) {

	// shift args if no error provided
	if (_.isNumber(res)) {
		contains = code;
		code = res;
		res = err;
		err = undefined;
	}

	const status = err ? err.status : res.status;
	const body = err ? err.response.body : res.body;

	if (status !== code) {
		console.log(res.body);
	}

	expect(status).to.be(code);
	if (contains) {
		expect(body.error.toLowerCase()).to.contain(contains.toLowerCase());
	}
};

exports.urlPath = function(url) {
	if (url[0] === '/') {
		return url;
	}
	let u = parseUrl(url);
	let q = u.search || '';
	let h = u.hash || '';
	return u.pathname + q + h;
};

exports.expectValidationError = function(err, res, field, contains, code) {
	if (!err) {
		throw new Error('Expected validation error but got status ' + res.status + '.');
	}
	expect(err.status).to.be(code || 422);
	expect(err.response.body.errors).to.be.an('array');
	const fieldErrors = _.filter(err.response.body.errors, { field: field });
	if (!fieldErrors.length) {
		throw new Error('Expected validation error on field "' + field + '" but got none.');
	}
	if (contains) {
		const matchedErrors = _.filter(fieldErrors, function(val) {
			return val.message.toLowerCase().indexOf(contains.toLowerCase()) > -1;
		});
		if (!matchedErrors.length) {
			throw new Error('Expected validation error on field "' + field + '" to contain "' + contains.toLowerCase() + '".');
		}
	}
};

exports.expectNoValidationError = function(err, res, field, contains) {
	if (_.isArray(err.response.body.errors)) {
		const fieldErrors = _.filter(err.response.body.errors, { field: field });
		if (contains) {
			const matchedErrors = _.filter(fieldErrors, function(val) {
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
	const that = this;

	return function(next) {
		let user = exports.genUser();
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
							return next(appendError(err, res));
						}
						if (res.status !== 200) {
							debug('%s <%s>: ERROR: %s', name, user.email, res.body.error);
							return next(res.body.error);
						}
						request.tokens[name] = res.body.token;
						that.users[name].token = res.body.token;

						// 3. update user
						debug('%s <%s>: Updating user...', name, user.email);
						user = _.extend(user, config);
						request
							.put('/api/v1/users/' + user.id)
							.as(superuser)
							.send(_.pick(user, [ 'name', 'email', 'username', 'is_active', 'roles', '_plan' ]))
							.end(function(err, res) {
								if (err) {
									return next(appendError(err, res));
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

function appendError(err, res) {
	let msg = err.message;
	if (res.error) {
		msg += ': ' + res.error;
	}
	if (res.body && res.body.error) {
		msg += ': ' + res.body.error;
	}
	return new Error(msg);
}