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
var async = require('async');
var logger = require('winston');

var LogEvent = require('mongoose').model('LogEvent');

var acl = require('../../acl');
var api = require('./api');
var error = require('../../modules/error')('api', 'eventlogs');
var config = require('../../modules/settings').current;


/**
 * Returns the current event stream.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var assert = api.assert(error, 'list', null, res);
	var query = [ { is_public: true }];

	async.waterfall([

		/**
		 * Sync filters
		 * @param next
		 */
		function(next) {

			// filter event
			if (req.query.event) {
				query.push({ event: { $in: req.query.event.split(',') }});
			}
			next(null, query);
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
		}

	], function(err, query, fullDetails) {

		// query
		var pagination = api.pagination(req, 10, 50);
		LogEvent.paginate(api.searchQuery(query), {
			page: pagination.page,
			limit: pagination.perPage,
			sortBy: { logged_at: -1 },
			populate: [ '_actor' ]

		}, function(err, logs, pageCount, count) {

			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error retrieving logs').log('list'), 500);
			}

			// process results
			logs = _.map(logs, function(log) {
				return fullDetails ? log.toObj() : _.omit(log.toObj(), [ 'ip' ]);
			});
			api.success(res, logs, 200, api.paginationOpts(pagination, count));
		});
	});

};
