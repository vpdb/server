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

var Game = require('mongoose').model('Game');
var api = require('./api');

var error = require('../../modules/error')('api', 'game');


/**
 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
 * @param {Request} req
 * @param {Response} res
 */
exports.head = function(req, res) {

	Game.findOne({ id: req.params.id }, function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding game "%s"', req.params.id).log('head'), 500);
		}
		res.set('Content-Length', 0);
		return res.status(game ? 200 : 404).end();
	});
};


/**
 * Creates a new game.
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	Game.getInstance(_.extend(req.body, {
		_created_by: req.user._id,
		created_at: new Date()
	}), function(err, newGame) {
		if (err) {
			return api.fail(res, error(err, 'Error creating game instance').log('create'), 500);
		}
		var assert = api.assert(error, 'create', newGame.id, res);
		var assertRb = api.assert(error, 'create', newGame.id, res, function(done) {
			newGame.remove(done);
		});
		logger.info('[api|game:create] %s', util.inspect(req.body));
		newGame.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}
			logger.info('[api|game:create] Validations passed.');
			newGame.save(assert(function(game) {
				logger.info('[api|game:create] Game "%s" created.', game.title);

				// set media to active
				game.activateFiles(assertRb(function(game) {
					logger.info('[api|game:create] All referenced files activated, returning object to client.');
					return api.success(res, game.toDetailed(), 201);

				}, 'Error activating files for game "%s"'));
			}, 'Error saving game with id "%s"'));
		});
	});
};


/**
 * Deletes a game.
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	var query = Game.findOne({ id: req.params.id })
		.populate({ path: '_media.backglass' })
		.populate({ path: '_media.logo' });

	query.exec(function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error getting game "%s"', req.params.id).log('delete'), 500);
		}
		if (!game) {
			return api.fail(res, error('No such game with ID "%s".', req.params.id), 404);
		}

		// TODO check for linked releases (& ROMs, etc) and refuse if referenced

		// remove from db
		game.remove(function(err) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error deleting game "%s" (%s)', game.id, game.title).log('delete'), 500);
			}
			logger.info('[api|game:delete] Game "%s" (%s) successfully deleted.', game.title, game.id);
			api.success(res, null, 204);
		});
	});
};


/**
 * Lists all games.
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var pagination = api.pagination(req, 12, 60);
	var query = [];

	// text search
	if (req.query.q) {

		if (req.query.q.trim().length < 2) {
			return api.fail(res, error('Query must contain at least two characters.'), 400);
		}

		// sanitize and build regex
		var titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
		var titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
		var idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune

		query.push({ $or: [ { title: titleRegex }, { id: idQuery } ] });
	}

	// filter by manufacturer
	if (req.query.mfg) {
		var mfgs = req.query.mfg.split(',');
		query.push({ manufacturer: mfgs.length === 1 ? mfgs[0] : { $in: mfgs } });
	}

	// filter by decade
	if (req.query.decade) {
		var decades = req.query.decade.split(',');
		var d = [];
		_.each(decades, function(decade) {
			d.push({ year: { $gte: parseInt(decade, 10), $lt: parseInt(decade, 10) + 10 }});
		});
		if (d.length === 1) {
			query.push(d[0]);
		} else {
			query.push({ $or: d });
		}
	}

	var sortBy = api.sortParams(req);
	var q = api.searchQuery(query);
	logger.info('[api|game:list] query: %s, sort: %j', util.inspect(q), util.inspect(sortBy));
	Game.paginate(q, pagination.page, pagination.perPage, function(err, pageCount, games, count) {

		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error listing games').log('list'), 500);
		}
		games = _.map(games, function(game) {
			return game.toSimple();
		});
		api.success(res, games, 200, api.paginationOpts(pagination, count));

	}, { populate: [ '_media.backglass', '_media.logo' ], sortBy: sortBy });
};


/**
 * Lists a game of a given game ID.
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	var query = Game.findOne({ id: req.params.id })
		.populate({ path: '_media.backglass' })
		.populate({ path: '_media.logo' });

	query.exec(function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error finding game "%s"', req.params.id).log('view'), 500);
		}
		if (!game) {
			return api.fail(res, error('No such game with ID "%s"', req.params.id), 404);
		}
		game.update({ $inc: { 'counter.views': 1 }}, function() {});
		game.toDetailed(function(err, game) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error populating game "%s"', req.params.id).log('view'), 500);
			}
			return api.success(res, game);
		});
	});
};
