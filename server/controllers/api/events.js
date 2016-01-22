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
var util = require('util');
var async = require('async');
var logger = require('winston');

var Star = require('mongoose').model('Star');
var Game = require('mongoose').model('Game');
var Release = require('mongoose').model('Release');
var User = require('mongoose').model('User');
var LogEvent = require('mongoose').model('LogEvent');

var acl = require('../../acl');
var api = require('./api');
var error = require('../../modules/error')('api', 'eventlogs');
var config = require('../../modules/settings').current;


exports.list = function(opts) {

	/**
	 * Returns the current event stream.
	 *
	 * @param {Request} req
	 * @param {Response} res
	 */
	return function(req, res) {

		opts = opts || {};
		var assert = api.assert(error, 'list', null, res);
		var query = [ { is_public: true }];
		var pagination = api.pagination(req, 10, 50);

		async.waterfall([

			/**
			 * Sync filters
			 * @param next
			 */
			function(next) {

				// filter event
				if (req.query.events) {
					var events = req.query.events.split(',');
					var eventsIn = [];
					var eventsNin = [];
					events.forEach(function(event) {
						if (event[0] === '!') {
							eventsNin.push(event.substr(1));
						} else {
							eventsIn.push(event);
						}
					});
					if (eventsIn.length > 0) {
						query.push({ event: { $in: eventsIn }});
					}
					if (eventsNin.length > 0) {
						query.push({ event: { $nin: eventsNin }});
					}
				}

				// user
				if (opts.loggedUser) {
					query.push({ _actor: req.user._id });
				}

				next(null, query);
			},

			/**
			 * By game
			 * @param query
			 * @param next
			 */
			function(query, next) {
				if (opts.byGame && req.params.id) {
					Game.findOne({ id: req.params.id }, assert(function(game) {
						if (!game) {
							api.fail(res, error('No such game with id %s.', req.params.id), 404);
							return next(true);
						}
						query.push({ '_ref.game': game._id });
						next(null, query);

					}, 'Error finding game.'));
				} else {
					next(null, query);
				}
			},

			/**
			 * By release
			 * @param query
			 * @param next
			 */
			function(query, next) {
				if (opts.byRelease && req.params.id) {
					Release.findOne({ id: req.params.id }, assert(function(release) {
						if (!release) {
							api.fail(res, error('No such release with id %s.', req.params.id), 404);
							return next(true);
						}
						query.push({ '_ref.release': release._id });
						next(null, query);

					}, 'Error finding release.'));
				} else {
					next(null, query);
				}
			},

			/**
			 * Starred events
			 *
			 * @param query
			 * @param next
			 * @returns {*}
			 */
			function(query, next) {

				if (!_.isUndefined(req.query.starred)) {
					if (!req.user) {
						api.fail(res, error('Must be logged when listing starred events.'), 401);
						return next(true);
					}

					Star.find({ _from: req.user._id }, function(err, stars) {
						/* istanbul ignore if  */
						if (err) {
							api.fail(res, error(err, 'Error searching stars for user <%s>.', req.user.email).log('list'), 500);
							return next(true);
						}
						var releaseIds = _.compact(_.map(_.map(stars, '_ref'), 'release'));
						var gameIds = _.compact(_.map(_.map(stars, '_ref'), 'game'));

						var or = [];
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
							api.success(res, [], 200, api.paginationOpts(pagination, 0));
							return next(true);
						}

						return next(null, query);
					});
				} else {
					next(null, query);
				}
			},

			/**
			 * Check for full details permission
			 * @param query
			 * @param next
			 */
			function(query, next) {

				if (req.user) {
					acl.isAllowed(req.user.id, 'users', 'full-details', assert(function(fullDetails) {
						next(null, query, fullDetails);

					}, 'Error checking for ACL "users/full-details"'));
				} else {
					next(null, query, false);
				}
			},

			/**
			 * By actor
			 *
			 * @param query
			 * @param fullDetails
			 * @param next
			 */
			function(query, fullDetails, next) {
				if (opts.byActor && req.params.id) {

					// check access
					if (!fullDetails) {
						api.fail(res, error('Access denied.'), 401);
						return next(true);
					}
					User.findOne({ id: req.params.id }, assert(function(user) {
						if (!user) {
							api.fail(res, error('No such user with id %s.', req.params.id), 404);
							return next(true);
						}
						query.push({ '_actor': user._id });
						next(null, query);

					}, 'Error finding user.'));
				} else {
					next(null, query);
				}
			}

		], function(err, query, fullDetails) {

			if (err) {
				// has already been treated.
				return;
			}

			logger.info('Events query: %s', util.inspect(query, { depth: null }));

			// query
			LogEvent.paginate(api.searchQuery(query), {
				page: pagination.page,
				limit: pagination.perPage,
				sort: { logged_at: -1 },
				populate: [ '_actor' ]

			}, function(err, result) {

				/* istanbul ignore if  */
				if (err) {
					return api.fail(res, error(err, 'Error retrieving logs').log('list'), 500);
				}

				// process results
				var logs = _.map(result.docs, function(log) {
					return fullDetails ? log.toObj() : _.omit(log.toObj(), [ 'ip' ]);
				});
				api.success(res, logs, 200, api.paginationOpts(pagination, result.total));
			});
		});

	};
};
