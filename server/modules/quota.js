/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var logger = require('winston');
var quotaModule = require('volos-quota-redis');

var error = require('./error')('quota').error;
var config = require('./settings').current;
var quotaConfig = config.vpdb.quota;

function Quota() {
	logger.info('[quota] Initializing quotas...');
	var duration;
	this.quota = {};
	// we create a quota module for each duration
	for (var plan in quotaConfig.plans) {
		if (quotaConfig.plans.hasOwnProperty(plan)) {
			if (quotaConfig.plans[plan].unlimited) {
				continue;
			}
			duration = quotaConfig.plans[plan].per;
			if (!this.quota[duration]) {
				logger.info('[quota] Creating quota for credits per %s...', duration);
				this.quota[duration] = quotaModule.create({
					timeUnit: duration,
					interval: 1,
					host: config.vpdb.redis.host,
					port: config.vpdb.redis.port,
					db: config.vpdb.redis.db
				});
			}
		}
	}
}

/**
 * Checks if there is enough quota for the given file and consumes a credit.
 *
 * It also adds the rate limit headers to the request.
 *
 * @param {object} req Request
 * @param {object} res Response
 * @param {File} file File to check for
 * @param {function} callback Callback with `err` and `isAllowed`
 * @returns {*}
 */
Quota.prototype.isAllowed = function(req, res, file, callback) {

	// undefined mime types are free
	if (!quotaConfig.costs[file.mime_type] && quotaConfig.costs[file.mime_type] !== 0) {
		return callback(null, true);
	}

	// return directly if file is free
	if (quotaConfig.costs[file.mime_type] === 0) {
		return callback(null, true);
	}

	// deny access to anon (free files would have been served by now)
	if (!req.user) {
		return callback(null, false);
	}

	var plan = req.user.plan || quotaConfig.defaultPlan;

	// allow unlimited plans
	if (quotaConfig.plans[plan].unlimited === true) {
		return callback(null, true);
	}

	if (!quotaConfig.plans[plan] && quotaConfig.plans[plan] !== 0) {
		return callback(error('No quota defined for plan "%s"', plan));
	}

	// https://github.com/apigee-127/volos/tree/master/quota/common#quotaapplyoptions-callback
	this.quota[quotaConfig.plans[plan].per].apply({
			identifier: req.user.id,
			weight: quotaConfig.costs[file.mime_type],
			allow: quotaConfig.plans[plan].credits
		},
		function(err, result) {
			if (err) {
				logger.error('[quota] Error checking quota for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			logger.info('[quota] Quota check %s on <%s> for %s with %d quota left for another %d seconds.', result.isAllowed ? 'passed' : 'FAILED', req.user.email, file.id, result.allowed - result.used, Math.round(result.expiryTime / 1000));
			res.set({
				'X-RateLimit-Limit': result.allowed,
				'X-RateLimit-Remaining': result.allowed - result.used,
				'X-RateLimit-Reset': result.expiryTime
			});
			callback(null, result.isAllowed);
		}
	);
};

module.exports = new Quota();