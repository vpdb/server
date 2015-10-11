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
var LogEvent = require('mongoose').model('LogEvent');
var Build = require('mongoose').model('Build');
var Game = require('mongoose').model('Game');
var Star = require('mongoose').model('Star');
var Tag = require('mongoose').model('Tag');
var File = require('mongoose').model('File');
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
		modified_at: now,
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
		// TODO if version date is set, push to files as well.
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
							.populate({ path: '_game' })
							.populate({ path: '_tags' })
							.populate({ path: 'authors._user' })
							.populate({ path: 'versions.files._file' })
							.populate({ path: 'versions.files._media.playfield_image' })
							.populate({ path: 'versions.files._media.playfield_video' })
							.populate({ path: 'versions.files._compatibility' })
							.exec(assert(function(release) {

								LogEvent.log(req, 'create_release', true, {
									release: _.pick(release.toSimple(), [ 'id', 'name', 'authors', 'latest_version' ]),
									game: _.pick(release._game.toSimple(), [ 'id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type' ])
								}, {
									release: release._id,
									game: release._game._id
								});

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
				release.modified_at = new Date();

				release.save(assert(function() {

					logger.info('[api|release:create] Added version "%s" to release "%s".', newVersion.version, release.name);

					// set media to active
					release.activateFiles(assert(function(release) {
						logger.info('[api|release:create] All referenced files activated, returning object to client.');

						// game modification date
						Game.update({ _id: release._game.toString() }, { modified_at: new Date() }, assert(function() {

							Release.findOne({ id: req.params.id })
								.populate({ path: '_game' })
								.populate({ path: 'versions.files._file' })
								.populate({ path: 'authors._user' })
								.populate({ path: 'versions.files._media.playfield_image' })
								.populate({ path: 'versions.files._media.playfield_video' })
								.populate({ path: 'versions.files._compatibility' })
								.exec(assert(function(release) {

									LogEvent.log(req, 'create_release_version', true, {
										release: _.pick(release.toSimple(), [ 'id', 'name', 'authors', 'latest_version' ]),
										game: _.pick(release._game.toSimple(), [ 'id', 'title', 'manufacturer', 'year', 'ipdb', 'game_type' ])
									}, {
										release: release._id,
										game: release._game._id
									});

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
				release.modified_at = new Date();
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
	if (req.query.thumb_flavor) {
		transformOpts.thumbFlavor = req.query.thumb_flavor;
		// ex.: /api/v1/releases?flavor=orientation:fs,lighting:day
	}
	if (req.query.thumb_format) {
		transformOpts.thumb = req.query.thumb_format;
	}
	if (!_.isUndefined(req.query.thumb_full_data)) {
		transformOpts.fullThumbData = true;
	}

	// filter by tag
	if (req.query.tags) {
		var t = req.query.tags.split(',');
		// all tags must be matched
		for (var i = 0; i < t.length; i++) {
			query.push({ _tags: { $in: [ t[i] ] }});
		}
	}

	// filter by release id
	if (req.query.ids) {
		var ids = req.query.ids.split(',');
		query.push({ id: { $in: ids }});
	}

	// now to the async stuff:
	async.waterfall([

		// text search
		function(next) {

			if (req.query.q) {

				if (req.query.q.trim().length < 3) {
					return api.fail(res, error('Query must contain at least two characters.'), 400);
				}

				// sanitize and build regex
				var titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
				var titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
				var idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune

				Game.find({ 'counter.releases': { $gt: 0 }, $or: [ { title: titleRegex }, { id: idQuery } ] }, '_id', function(err, games) {
					/* istanbul ignore if  */
					if (err) {
						api.fail(res, error(err, 'Error searching games with query "%s"', idQuery).log('list'), 500);
						return next(true);
					}
					var gameIds = _.pluck(games, '_id');
					if (gameIds.length > 0) {
						query.push({ $or: [ { name: titleRegex }, { '_game': { $in: gameIds }} ] });
					} else {
						query.push({ name: titleRegex });
					}

					next(null, query);
				});

			} else {
				next(null, query);
			}
		},

		// stars
		function(query, next) {

			// only if logged
			if (!req.user) {
				return next(null, query, null);
			}

			Star.find({ type: 'release', _from: req.user._id }, '_ref.release', function(err, stars) {
				/* istanbul ignore if  */
				if (err) {
					api.fail(res, error(err, 'Error searching starred releases for user <%s>.', req.user.email).log('list'), 500);
					return next(true);
				}
				var releaseIds = _.pluck(_.pluck(stars, '_ref'), 'release');
				next(null, query, releaseIds);
			});
		},

		// starred
		function(query, stars, next) {

			if (!_.isUndefined(req.query.starred)) {

				if (!req.user) {
					api.fail(res, error('Must be logged when listing starred releases.'), 401);
					return next(true);
				}
				if (req.query.starred === "false") {
					query.push({ _id: { $nin: stars } });
				} else {
					query.push({ _id: { $in: stars } });
				}
			}
			next(null, query, stars);
		},

		// compat filter
		function(query, stars, next) {

			if (!_.isUndefined(req.query.builds)) {

				var buildIds = req.query.builds.split(',');
				Build.find({ id: { $in: buildIds }}, function(err, builds) {
					/* istanbul ignore if  */
					if (err) {
						api.fail(res, error(err, 'Error searching builds for user <%s>.', req.user.email).log('list'), 500);
						return next(true);
					}
					query.push({ 'versions.files._compatibility': { $in: _.pluck(builds, '_id') }});
					next(null, query, stars);
				});

			} else {
				next(null, query, stars);
			}
		},

		// file size filter
		function(query, stars, next) {

			var filesize = parseInt(req.query.filesize);
			if (filesize) {
				var threshold = parseInt(req.query.threshold);
				var q = { file_type: 'release' };
				if (threshold) {
					q.bytes = { $gt: filesize - threshold, $lt: filesize + threshold };
				} else {
					q.bytes = filesize;
				}
				console.log(q);
				File.find(q, function(err, files) {
					/* istanbul ignore if  */
					if (err) {
						api.fail(res, error(err, 'Error searching files with size %s.', filesize).log('list'), 500);
						return next(true);
					}
					if (files && files.length > 0) {
						query.push({ 'versions.files._file': { $in: _.pluck(files, '_id') }});
					} else {
						query.push({ _id: null }); // no result
					}

					next(null, query, stars);
				});

			} else {
				next(null, query, stars);
			}
		},

		// inner filters
		function(query, stars, next) {

			var filter = [];
			if (!_.isUndefined(req.query.flavor)) {

				_.each(req.query.flavor.split(','), function(f) {
					var kv = f.split(':');
					var k = kv[0].toLowerCase();
					var v = kv[1].toLowerCase();
					if (flavor.values[k]) {
						var fltr = {};
						fltr['versions.files.flavor.' + k] = { $in: [ 'any', v ]};
						filter.push(fltr);
					}
				});
			}

			next(null, query, stars, filter);
		}

	// result
	], function(err, query, stars, filter) {

		if (err) {
			// error has been treated.
			return;
		}

		var starMap = {};
		if (stars) {
			_.map(stars, function(id) {
				starMap[id] = true;
			});
		}

		var sortBy = api.sortParams(req, { modified_at: 1 }, {
			modified_at: '-modified_at',
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			name: 'name_sortable',
			num_downloads: '-counter.downloads',
			num_comments: '-counter.comments',
			num_stars: '-counter.stars'
		});

		var populatedFields = [ '_game', 'versions.files._file', 'versions.files._media.playfield_image', 'versions.files._compatibility', 'authors._user' ];

		if (filter.length > 0) {

			console.log(util.inspect(Release.getAggregationPipeline(query, filter, sortBy, pagination), { depth: null, colors: true }));
			Release.aggregate(Release.getAggregationPipeline(query, filter, sortBy, pagination)).exec(function(err, result) {

				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error listing releases').log('list'), 500);
				}

				// populate
				Release.populate(result, populatedFields, function(err, releases) {
					/* istanbul ignore if  */
					if (err) {
						return api.fail(res, error(err, 'Error listing releases').log('list'), 500);
					}

					releases = _.map(releases, function(release) {
						if (stars) {
							transformOpts.starred = starMap[release._id] ? true : false;
						}
						return Release.toSimple(release, transformOpts);
					});

					// count
					Release.count(query, function(err, count) {
						/* istanbul ignore if  */
						if (err) {
							return api.fail(res, error(err, 'Error counting releases').log('list'), 500);
						}
						api.success(res, releases, 200, api.paginationOpts(pagination, count));
					});
				});
			});

		} else {

			var q = api.searchQuery(query);
			logger.info('[api|release:list] query: %s, sort: %j', util.inspect(q), util.inspect(sortBy));
			Release.paginate(q, {
				page: pagination.page,
				limit: pagination.perPage,
				populate: populatedFields,
				sortBy: sortBy  // '_game.title', '_game.id'

			}, function(err, releases, pageCount, count) {

				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error listing releases').log('list'), 500);
				}
				releases = _.map(releases, function(release) {
					if (stars) {
						transformOpts.starred = starMap[release._id] ? true : false;
					}
					return release.toSimple(transformOpts);
				});
				api.success(res, releases, 200, api.paginationOpts(pagination, count));
			});
		}
	});

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

