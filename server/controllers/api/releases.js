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
var logger = require('winston');

var Release = require('mongoose').model('Release');
var api = require('./api');

var error = require('../../modules/error')('api', 'release');


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
		if (newRelease.versions[0]) {
			newRelease.versions[0] = _.defaults(newRelease.versions[0], { released_at: now });
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
					return api.success(res, release.toDetailed(), 201);

				}, 'Error activating files for release "%s"'));
			}, 'Error saving release with id "%s"'));
		});
	});
};


/**
 * Lists all releases.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var pagination = api.pagination(req, 12, 60);
	var q, query = [];

	// flavor, thumb selection
	var transformOpts = { flavor: {} };
	if (req.query.flavor) {
		// /api/v1/releases?flavor=orientation:fs,lighting:day
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


	// sorting
	var sortBy = {};
	if (req.query.sort) {
		var s = req.query.sort.match(/^(-?)([a-z0-9_-]+)+$/);
		if (s) {
			sortBy[s[2]] = s[1] ? -1 : 1;
		} else {
			sortBy.released_at = -1;
		}
	} else {
		sortBy.released_at = -1;
	}

	// construct query object
	if (query.length === 0) {
		q = {};
	} else if (query.length === 1) {
		q = query[0];
	} else {
		q = { $and: query };
	}
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
