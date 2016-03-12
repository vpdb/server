/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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
var async = require('async');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var Release = require('mongoose').model('Release');
var Star = require('mongoose').model('Star');
var Rom = require('mongoose').model('Rom');
var LogEvent = require('mongoose').model('LogEvent');

var api = require('./api');

var error = require('../../modules/error')('api', 'game');


/**
 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
 * @param {Request} req
 * @param {Response} res
 */
exports.head = function(req, res) {

	Promise.try(() => {
		// retrieve game
		return Game.findOne({ id: req.params.id }).exec();

	}).then(game => {
		res.set('Content-Length', 0);
		return res.status(game ? 200 : 404).end();

	}).catch(api.handleError(res, error, 'Error retrieving game'));
};


/**
 * Creates a new game.
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	var game;
	Promise.try(() => {
		return Game.getInstance(_.assign(req.body, {
			_created_by: req.user._id,
			created_at: new Date()
		}));

	}).then(newGame => {
		game = newGame;
		logger.info('[api|game:create] %s', util.inspect(req.body));
		return newGame.validate();

	}).then(() => {
		logger.info('[api|game:create] Validations passed.');
		return game.save();

	}).then(() => {
		logger.info('[api|game:create] Game "%s" created.', game.title);
		return game.activateFiles();

	}).then(() => {
		// link roms if available
		if (game.ipdb && game.ipdb.number) {
			return Rom.find({ _ipdb_number: game.ipdb.number }).exec().then(roms => {
				logger.info('[api|game:create] Linking %d ROMs to created game %s.', roms.length, game._id);
				return Promise.each(roms, rom => {
					rom._game = game._id.toString();
					return rom.save();
				});
			});
		}

	}).then(() => {
		LogEvent.log(req, 'create_game', true, { game: _.omit(game.toSimple(), [ 'rating', 'counter' ]) }, { game: game._id });
		api.success(res, game.toDetailed(), 201);

	}).catch(api.handleError(res, error, 'Error creating game'));
};


/**
 * Deletes a game.
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	let game;
	Promise.try(() => {
		return Game.findOne({ id: req.params.id })
			.populate({ path: '_media.backglass' })
			.populate({ path: '_media.logo' })
			.exec();
	}).then(g => {
		game = g;

		if (!game) {
			throw error('No such game with ID "%s".', req.params.id).status(404);
		}
		// TODO check for linked releases (& ROMs, etc) and refuse if referenced
		return game.remove();

	}).then(() => {
		logger.info('[api|game:delete] Game "%s" (%s) successfully deleted.', game.title, game.id);
		api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting game'));
};


/**
 * Lists all games.
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	let pagination = api.pagination(req, 12, 60);
	let query = [];

	Promise.try(() => {

		// text search
		if (req.query.q) {
			if (req.query.q.trim().length < 2) {
				throw error('Query must contain at least two characters.').status(400);
			}
			// sanitize and build regex
			let titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
			let titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			let idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			query.push({ $or: [{ title: titleRegex }, { id: idQuery }] });
		}

		// filter by manufacturer
		if (req.query.mfg) {
			let mfgs = req.query.mfg.split(',');
			query.push({ manufacturer: mfgs.length === 1 ? mfgs[0] : { $in: mfgs } });
		}

		// filter by decade
		if (req.query.decade) {
			let decades = req.query.decade.split(',');
			let d = [];
			decades.forEach(function(decade) {
				d.push({ year: { $gte: parseInt(decade, 10), $lt: parseInt(decade, 10) + 10 } });
			});
			if (d.length === 1) {
				query.push(d[0]);
			} else {
				query.push({ $or: d });
			}
		}

		if (parseInt(req.query.min_releases)) {
			query.push({ 'counter.releases': { $gte: parseInt(req.query.min_releases) } });
		}

		let sort = api.sortParams(req, { title: 1 }, {
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			title: 'title_sortable'
		});

		let q = api.searchQuery(query);
		logger.info('[api|game:list] query: %s, sort: %j', util.inspect(q), util.inspect(sort));

		return Game.paginate(q, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: ['_media.backglass', '_media.logo'],
			sort: sort
		}).then(result => [result.docs, result.total]);

	}).spread((results, count) => {

		let games = results.map(game => game.toSimple());
		api.success(res, games, 200, api.paginationOpts(pagination, count));

	}).catch(api.handleError(res, error, 'Error listing games'));
};


/**
 * Lists a game of a given game ID.
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	let game, opts;
	Promise.try(() => {
		// retrieve game
		return Game.findOne({ id: req.params.id })
			.populate({ path: '_media.backglass' })
			.populate({ path: '_media.logo' })
			.exec();

	}).then(g => {
		game = g;
		if (!game) {
			throw error('No such game with ID "%s"', req.params.id).status(404);
		}
		return game.incrementCounter('views');

	}).then(() => {

		// retrieve stars if logged
		if (!req.user) {
			return null;
		}
		return Star.find({ type: 'release', _from: req.user._id }, '_ref.release').exec().then(stars => {
			return _.map(_.map(_.map(stars, '_ref'), 'release'), id => id.toString());
		});

	}).then(starredReleaseIds => {

		opts = { starredReleaseIds: starredReleaseIds };
		return Release.find({ _game: game._id })
			.populate({ path: '_tags' })
			.populate({ path: '_created_by' })
			.populate({ path: 'authors._user' })
			.populate({ path: 'versions.files._file' })
			.populate({ path: 'versions.files._media.playfield_image' })
			.populate({ path: 'versions.files._media.playfield_video' })
			.populate({ path: 'versions.files._compatibility' })
			.exec();

	}).then(releases => {
		let result = game.toDetailed();
		result.releases = _.map(releases, release => _.omit(release.toDetailed(opts), 'game'));
		api.success(res, result, 200);

	}).catch(api.handleError(res, error, 'Error viewing game'));
};