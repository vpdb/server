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
var logger = require('winston');

var LogUser = require('mongoose').model('LogUser');

var api = require('./api');
var error = require('../../modules/error')('api', 'userlogs');
var config = require('../../modules/settings').current;


/**
 * Returns the current user's profile.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	var assert = api.assert(error, 'list', req.user.email, res);

	var pagination = {
		defaultPerPage: 30,
		maxPerPage: 100
	};
	var q, query = [];

	// filter event
	if (req.query.event) {
		var events = req.query.event.split(',');
		var d = [];
		_.each(events, function(event) {
			d.push({ event: event });
		});
		if (d.length === 1) {
			query.push(d[0]);
		} else {
			query.push({ $or: d });
		}
	}

	// pagination
	var page = Math.max(req.query.page, 1) || 1;
	var perPage = Math.max(0, Math.min(req.query.per_page, pagination.maxPerPage)) || pagination.defaultPerPage;

	// construct query object
	if (query.length === 0) {
		q = {};
	} else if (query.length === 1) {
		q = query[0];
	} else {
		q = { $and: query };
	}

	// query
	LogUser.paginate(q, page, perPage, function(err, pageCount, logs, count) {

		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error retrieving logs').log('list'), 500);
		}

		var providerInfo = {
			github: { name: 'GitHub', icon: 'github' },
			local: { name: 'Local Account', icon: 'vpdb' }
		};
		_.each(config.vpdb.passport.ipboard, function(ipb) {
			providerInfo[ipb.id] = _.pick(ipb, ['name', 'icon']);
		});

		// process results
		logs = _.map(logs, function(log) {

			if (providerInfo[log.data.provider]) {
				log.data.providerInfo = providerInfo[log.data.provider];
			}
			log = log.toObject();
			delete log.user;
			return log;
		});
		api.success(res, logs, 200, { pagination: { page: page, perPage: perPage, count: count }});

	}, { populate: [ '_user', '_actor' ], sortBy: { logged_at: -1 } });

};
