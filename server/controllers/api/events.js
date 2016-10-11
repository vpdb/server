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

const _ = require('lodash');
const util = require('util');
const async = require('async');
const logger = require('winston');

const Star = require('mongoose').model('Star');
const Game = require('mongoose').model('Game');
const Release = require('mongoose').model('Release');
const User = require('mongoose').model('User');
const LogEvent = require('mongoose').model('LogEvent');

const acl = require('../../acl');
const api = require('./api');
const error = require('../../modules/error')('api', 'eventlogs');


exports.list = function(opts) {

	opts = opts || {};
	return function(req, res) {

		let query = [ { is_public: true } ];
		let pagination = api.pagination(req, 10, 50);

		let fullDetails;
		let emptyResult = false;
		return Promise.try(() => {

			// filter event
			if (req.query.events) {
				let events = req.query.events.split(',');
				let eventsIn = [];
				let eventsNin = [];
				events.forEach(function(event) {
					if (event[ 0 ] === '!') {
						eventsNin.push(event.substr(1));
					} else {
						eventsIn.push(event);
					}
				});
				if (eventsIn.length > 0) {
					query.push({ event: { $in: eventsIn } });
				}
				if (eventsNin.length > 0) {
					query.push({ event: { $nin: eventsNin } });
				}
			}

			// user
			if (opts.loggedUser) {
				query.push({ _actor: req.user._id });
			}

			// by game
			if (opts.byGame && req.params.id) {
				return Game.findOne({ id: req.params.id }).exec().then(game => {
					if (!game) {
						throw error('No such game with id %s.', req.params.id).status(404);
					}
					query.push({ '_ref.game': game._id });
				});
			}

		}).then(() => {

			// by release
			if (opts.byRelease && req.params.id) {
				let release;
				return Release.findOne({ id: req.params.id }).populate('_game').exec().then(r => {
					release = r;
					if (!release) {
						throw error('No such release with id %s.', req.params.id).status(404);
					}
					return Release.hasRestrictionAccess(req, release._game, release);

				}).then(hasAccess => {
					if (!hasAccess) {
						throw error('No such release with ID "%s"', req.params.id).status(404);
					}
					query.push({ '_ref.release': release._id });

				});
			}

		}).then(() => {

			// starred events
			if (!_.isUndefined(req.query.starred)) {
				if (!req.user) {
					throw error('Must be logged when listing starred events.').status(401);
				}

				return Star.find({ _from: req.user._id }).exec().then(stars => {
					let releaseIds = _.compact(_.map(_.map(stars, '_ref'), 'release'));
					let gameIds = _.compact(_.map(_.map(stars, '_ref'), 'game'));

					let or = [];
					if (releaseIds.length > 0) {
						or.push({ '_ref.release': { $in: releaseIds } });
					}
					if (gameIds.length > 0) {
						or.push({ '_ref.game': { $in: gameIds } });
					}
					if (or.length > 0) {
						query.push({ $or: or });

					} else {
						// return empty result (nothing starred)
						emptyResult = true;
					}
				});
			}

		}).then(() => {

			// check for full details permission
			if (req.user) {
				return acl.isAllowed(req.user.id, 'users', 'full-details').then(result => fullDetails = result);
			}

		}).then(() => {

			// by actor
			if (opts.byActor && req.params.id) {

				// check access
				if (!fullDetails) {
					throw error('Access denied.').status(401);
				}
				return User.findOne({ id: req.params.id }).exec().then(user => {
					if (!user) {
						throw error('No such user with id %s.', req.params.id).status(404);
					}
					query.push({ '_actor': user._id });
				});
			}

		}).then(() => {
			logger.info('Events query: %s', util.inspect(query, { depth: null }));

			if (emptyResult) {
				return [ [], 0 ];
			}

			// query
			return LogEvent.paginate(api.searchQuery(query), {
				page: pagination.page,
				limit: pagination.perPage,
				sort: { logged_at: -1 },
				populate: [ '_actor' ]

			}).then(result => [ result.docs, result.total ]);

		}).spread((results, count) => {

			let logs = results.map(log => fullDetails ? log.toObj() : _.omit(log.toObj(), [ 'ip' ]));
			api.success(res, logs, 200, api.paginationOpts(pagination, count));

		}).catch(api.handleError(res, error, 'Error listing events'));
	};
};
