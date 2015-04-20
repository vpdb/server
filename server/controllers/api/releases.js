/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict";

var _ = require('lodash');
var util = require('util');
var async = require('async');
var logger = require('winston');

var Release = require('mongoose').model('Release');
var Version = require('mongoose').model('ReleaseVersion');
var VersionFile = require('mongoose').model('ReleaseVersionFile');
var Game = require('mongoose').model('Game');
var api = require('./api');

var error = require('../../modules/error')('api', 'release');
var flavor = require('../../modules/flavor');

/**
 * Creates a new release.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	var now = new Date();
	Release.getInstance(_.extend(req.body, {
		_created_by: req.user._id,
		created_at: now
	}), function(err, newRelease) {
		if (err) {
			return api.fail(res, error(err, 'Error creating release instance').log('create'), 500);
		}
		var assert = api.assert(error, 'create', newRelease.name, res);
		var assertRb = api.assert(error, 'create', newRelease.name, res, function(done) {
			newRelease.remove(done);
		});

		// defaults
		if (newRelease.versions) {
			_.each(newRelease.versions, function(version) {
				_.defaults(version, { released_at: now });
				if (version.files) {
					_.each(version.files, function(file) {
						_.defaults(file, { released_at: now });
					});
				}
			});
		}

		logger.info('[api|release:create] %s', util.inspect(req.body));
		newRelease.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}
			logger.info('[api|release:create] Validations passed.');
			newRelease.save(assert(function(release) {
				logger.info('[api|release:create] Release "%s" created.', release.name);

				// set media to active
				release.activateFiles(assertRb(function(release) {
					logger.info('[api|release:create] All referenced files activated, returning object to client.');

					// update counters / date
					var counters = [];
					counters.push(function(next) {
						release.populate('_game', assert(function(release) {
							release._game.incrementCounter('releases', next);
						}));
					});
					counters.push(function(next) {
						Game.update({ _id: release._game.toString() }, { modified_at: new Date() }, next);
					});

					async.series(counters, function() {

						Release.findById(release._id)
							.populate({ path: '_tags' })
							.populate({ path: 'authors._user' })
							.populate({ path: 'versions.files._file' })
							.populate({ path: 'versions.files._media.playfield_image' })
							.populate({ path: 'versions.files._media.playfield_video' })
							.populate({ path: 'versions.files._compatibility' })
							.exec(assert(function(release) {

								return api.success(res, release.toDetailed(), 201);

							}, 'Error fetching updated release "%s".'));
					});

				}, 'Error activating files for release "%s"'));
			}, 'Error saving release with id "%s"'));
		});
	});
};

/**
 * Adds a new version to an existing release.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.addVersion = function(req, res) {

	var now = new Date();
	var assert = api.assert(error, 'addVersion', req.params.id, res);

	Release.findOne({ id: req.params.id }, assert(function(release) {
		if (!release) {
			return api.fail(res, error('No such release with ID "%s".', req.params.id), 404);
		}

		// only allow authors to upload version updates
		if (!_.contains(_.map(_.pluck(release.authors, '_user'), function(id) { return id.toString(); }), req.user._id.toString())) {
			return api.fail(res, error('Only authors of the release can add new versions.', req.params.id), 403);
		}

		var versionObj = _.defaults(req.body, { released_at: now });
		if (versionObj.files) {
			_.each(versionObj.files, function(file) {
				_.defaults(file, { released_at: now });
			});
		}

		logger.info('[api|release:addVersion] %s', util.inspect(versionObj, { depth: null }));
		Version.getInstance(versionObj, assert(function(newVersion) {

			logger.info('[api|release:addVersion] %s', util.inspect(versionObj, { depth: null }));
			logger.info('[api|release:addVersion] %s', util.inspect(newVersion, { depth: null }));

			newVersion.validate(function(err) {
				// validate existing version here
				if (_.filter(release.versions, { version: versionObj.version }).length > 0) {
					err = err || {};
					err.errors = [{ path: 'version', message: 'Provided version already exists and you cannot add a version twice. Try updating the version instead of adding a new one.', value: versionObj.version }];
				}
				if (err) {
					return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
				}

				logger.info('[api|release:addVersion] Validations passed, adding new version to release.');
				release.versions.push(newVersion);
				release.save(assert(function() {

					logger.info('[api|release:create] Added version "%s" to release "%s".', newVersion.version, release.name);

					// set media to active
					release.activateFiles(assert(function(release) {
						logger.info('[api|release:create] All referenced files activated, returning object to client.');

						// game modification date
						Game.update({ _id: release._game.toString() }, { modified_at: new Date() }, assert(function() {

							Release.findOne({ id: req.params.id })
								.populate({ path: 'versions.files._file' })
								.populate({ path: 'versions.files._media.playfield_image' })
								.populate({ path: 'versions.files._media.playfield_video' })
								.populate({ path: 'versions.files._compatibility' })
								.exec(assert(function(release) {

									return api.success(res, _.filter(release.toDetailed().versions, { version: versionObj.version })[0], 201);

							}, 'Error fetching updated release "%s".'));
						}, 'Error updating game modification date'));
					}, 'Error activating files for release "%s"'));
				}, 'Error adding new version to release "%s".'));
			});
		}, 'Error creating version instance for release "%s".'));
	}, 'Error getting release "%s"'));
};

/**
 * Updates an existing version.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.updateVersion = function(req, res) {

	var updateableFields = [ 'version', 'changes' ];

	var now = new Date();
	var assert = api.assert(error, 'updateVersion', req.params.id, res);

	Release.findOne({ id: req.params.id }).populate('versions.files._compatibility').exec(assert(function(release) {
		if (!release) {
			return api.fail(res, error('No such release with ID "%s".', req.params.id), 404);
		}

		// only allow authors to upload version updates
		if (!_.contains(_.map(_.pluck(release.authors, '_user'), function(id) { return id.toString(); }), req.user._id.toString())) {
			return api.fail(res, error('Only authors of the release can add new files of a version.', req.params.id), 403);
		}

		var versions = _.filter(release.versions, { version: req.params.version });
		if (versions.length === 0) {
			return api.fail(res, error('No such version "%s" for release "%s".', req.params.version, req.params.id), 404);
		}
		var version = versions[0];
		var versionObj = req.body;
		var newFiles = [];
		logger.info('[api|release:updateVersion] %s', util.inspect(versionObj, { depth: null }));

		async.eachSeries(versionObj.files || [], function(fileObj, next) {

			// defaults
			_.defaults(fileObj, { released_at: now });

			VersionFile.getInstance(fileObj, function(err, newVersionFile) {
				if (err) {
					api.fail(res, error('Error creating instance for posted version.'), 500);
					return next(err);
				}
				version.files.push(newVersionFile);
				newFiles.push(newVersionFile);
				next();
			});

		}, function(err) {
			if (err) {
				return;
			}
			release.validate(function(err) {

				if (err) {
					/* for some reason, mongoose runs the validations twice, once in release context and once in
					 * versions context, producing errors for files.0.* as well as versions.0.files.0.*, where
					 * the first one should not be produced. however, since we strip (without(...)), that's not
					 * a problem right now but might be in the future.
					 */
					return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).without(/^versions\.\d+\./).warn('updateVersion'), 422);
				}

				logger.info('[api|release:updateVersion] Validations passed, updating version.');
				release.save(function(err) {

					if (err) {
						return api.fail(res, error('Error saving release: %s', err.message).errors(err.errors).log('updateVersion'), 500);
					}

					logger.info('[api|release:create] Added new file to version "%s" to release "%s".', version.version, release.name);

					// set media to active
					async.eachSeries(newFiles, function(file, next) {
						file.activateFiles(next);

					}, function(err) {
						if (err) {
							return api.fail(res, error('Error activating files.').log('updateVersion'), 422);
						}

						logger.info('[api|release:create] All referenced files activated, returning object to client.');

						// game modification date
						Game.update({ _id: release._game.toString() }, { modified_at: new Date() }, assert(function() {

							Release.findOne({ id: req.params.id })
								.populate({ path: 'versions.files._file' })
								.populate({ path: 'versions.files._media.playfield_image' })
								.populate({ path: 'versions.files._media.playfield_video' })
								.populate({ path: 'versions.files._compatibility' })
								.exec(assert(function(release) {
									var version = _.filter(release.toDetailed().versions, { version: req.params.version })[0];
									return api.success(res, version, 201);

								}, 'Error fetching updated release "%s"'));
						}, 'Error updating game modification date'));
					});
				});
			});
		});
	}, 'Error getting release "%s"'));
};

/**
 * Lists all releases.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var pagination = api.pagination(req, 12, 60);
	var query = [];

	// flavor, thumb selection
	var transformOpts = {};
	if (req.query.flavor) {
		// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
		transformOpts.flavor = {};
		var flavorParams = req.query.flavor.split(',');
		_.each(flavorParams, function(param) {
			var f = param.split(':');
			if (f[0] && f[1]) {
				transformOpts.flavor[f[0]] = f[1];
			}
		});
	}
	if (req.query.thumb) {
		transformOpts.thumb = req.query.thumb;
	}

	// text search
	if (req.query.q) {

		if (req.query.q.trim().length < 2) {
			return api.fail(res, error('Query must contain at least two characters.'), 400);
		}

		// sanitize and build regex
		var titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
		var titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
		var idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune

		query.push({ $or: [ { name: titleRegex }, { 'game.title': titleRegex}, { id: idQuery } ] });
	}

	// filter by tag
	if (req.query.tag) {
		query.push({ _tags: { $in: req.query.tag.split(',') }});
	}

	var sortBy = api.sortParams(req);
	var q = api.searchQuery(query);
	logger.info('[api|release:list] query: %s, sort: %j', util.inspect(q), util.inspect(sortBy));
	Release.paginate(q, pagination.page, pagination.perPage, function(err, pageCount, releases, count) {

		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error listing releases').log('list'), 500);
		}
		releases = _.map(releases, function(release) {
			return release.toSimple(transformOpts);
		});
		api.success(res, releases, 200, api.paginationOpts(pagination, count));

	}, { populate: [ '_game', 'versions.files._media.playfield_image', 'authors._user' ], sortBy: sortBy }); // '_game.title', '_game.id'
};

/**
 * Lists a release of a given ID.
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	var query = Release.findOne({ id: req.params.id })
		.populate({ path: '_tags' })
		.populate({ path: 'authors._user' })
		.populate({ path: 'versions.files._file' })
		.populate({ path: 'versions.files._media.playfield_image' })
		.populate({ path: 'versions.files._media.playfield_video' })
		.populate({ path: 'versions.files._compatibility' });

	query.exec(function (err, release) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding release "%s"', req.params.id).log('view'), 500);
		}
		if (!release) {
			return api.fail(res, error('No such release with ID "%s"', req.params.id), 404);
		}
		return api.success(res, release.toDetailed());
	});
};


/**
 * Deletes a release.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var query = Release.findOne({ id: req.params.id })
		.populate({ path: 'versions.0.files.0._file' })
		.populate({ path: 'versions.0.files.0._media.playfield_image' })
		.populate({ path: 'versions.0.files.0._media.playfield_video' });

	query.exec(function(err, release) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error getting release "%s"', req.params.id).log('delete'), 500);
		}
		if (!release) {
			return api.fail(res, error('No such release with ID "%s".', req.params.id), 404);
		}

		// only allow deleting own files (for now)
		if (!release._created_by.equals(req.user._id)) {
			return api.fail(res, error('Permission denied, must be owner.'), 403);
		}

		// todo check if there are references (comments, etc)


		// remove from db
		release.remove(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error deleting release "%s" (%s)', release.id, release.name).log('delete'), 500);
			}
			logger.info('[api|release:delete] Release "%s" (%s) successfully deleted.', release.name, release.id);
			api.success(res, null, 204);
		});
	});
};
