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

'use strict';

const _ = require('lodash');

const LogUser = require('mongoose').model('LogUser');

const api = require('./api');
const error = require('../../modules/error')('api', 'userlogs');
const config = require('../../modules/settings').current;

/**
 * Returns the current user's log.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	const pagination = api.pagination(req, 30, 100);
	const query = [{ _user: req.user._id, _actor: req.user._id }];

	// filter event
	if (req.query.event) {
		const events = req.query.event.split(',');
		const d = [];
		events.forEach(function(event) {
			d.push({ event: event });
		});
		if (d.length === 1) {
			query.push(d[0]);
		} else {
			query.push({ $or: d });
		}
	}

	// query
	LogUser.paginate(api.searchQuery(query), {
		page: pagination.page,
		limit: pagination.perPage,
		sort: { logged_at: -1 }

	}, function(err, result) {

		/* istanbul ignore if  */
		if (err) {
			return api.fail(res, error(err, 'Error retrieving logs').log('list'), 500);
		}

		const providerInfo = {
			google: { name: 'Google', icon: 'google-g' },
			github: { name: 'GitHub', icon: 'github' },
			local: { name: 'Local Account', icon: 'vpdb' }
		};
		config.vpdb.passport.ipboard.forEach(function(ipb) {
			providerInfo[ipb.id] = _.pick(ipb, ['name', 'icon']);
		});

		// process results
		const logs = _.map(result.docs, function(log) {

			if (providerInfo[log.payload.provider]) {
				log.payload.providerInfo = providerInfo[log.payload.provider];
			}
			return log.toObj();
		});
		api.success(res, logs, 200, api.paginationOpts(pagination, result.total));
	});
};
