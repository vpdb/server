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
var logger = require('winston');
var quotaModule = require('volos-quota-redis');

var error = require('./error')('quota');
var config = require('./settings').current;
var quotaConfig = config.vpdb.quota;

function Quota() {
	logger.info('[quota] Initializing quotas...');
	var duration;
	this.quota = {};
	// we create a quota module for each duration
	for (var plan in quotaConfig.plans) {
		if (quotaConfig.plans.hasOwnProperty(plan)) {
			if (quotaConfig.plans[plan].unlimited === true) {
				logger.info('[quota] Skipping unlimited plan "%s".', plan);
				continue;
			}
			duration = quotaConfig.plans[plan].per;
			if (!this.quota[duration]) {
				logger.info('[quota] Setting up quota per %s for plan %s...', duration, plan);
				this.quota[duration] = quotaModule.create({
					timeUnit: duration,
					interval: 1,
					host: config.vpdb.redis.host,
					port: config.vpdb.redis.port,
					db: config.vpdb.redis.db
				});
			} else {
				logger.info('[quota] Not setting up plan %s because volos needs setups per duration and we already set up per %s.', plan, duration);
			}
		}
	}
}

/**
 * Returns the current rate limits for the given user.
 * @param user
 * @param callback
 */
Quota.prototype.getCurrent = function(user, callback) {

	var plan = user._plan || quotaConfig.defaultPlan;

	// undefined? plans might have changed and migration failed or whatever: fall back to default plan
	if (!_.isObject(quotaConfig.plans[plan])) {
		plan = quotaConfig.defaultPlan;
	}

	// unlimited?
	if (quotaConfig.plans[plan].unlimited === true) {
		return callback(null, { unlimited: true, limit: 0, period: 'never', remaining: 0, reset: 0 });
	}

	var that = this;

	// retrieve
	that.quota[quotaConfig.plans[plan].per].apply({
			identifier: user.id,
			weight: -2,
			allow: quotaConfig.plans[plan].credits
		},
		function (err) {
			if (err) {
				logger.error('[quota] Error retrieving quota for <%s>: %s', user.email, err, {});
				return callback(err);
			}

			// TODO fix when fixed: https://github.com/apigee-127/volos/issues/33
			that.quota[quotaConfig.plans[plan].per].apply({
					identifier: user.id,
					weight: 2,
					allow: quotaConfig.plans[plan].credits
				},
				function (err, result) {
					if (err) {
						logger.error('[quota] Error retrieving quota for <%s>: %s', user.email, err, {});
						return callback(err);
					}

					callback(null, {
						unlimited: false,
						period: quotaConfig.plans[plan].per,
						limit: result.allowed,
						remaining: result.allowed - result.used,
						reset: result.expiryTime
					});

				});
		}
	);
};

/**
 * Checks if there is enough quota for the given file and consumes a credit.
 *
 * It also adds the rate limit headers to the request.
 *
 * @param {object} req Request
 * @param {object} res Response
 * @param {File|File[]} files File(s) to check for
 * @param {function} callback Callback with `err` and `isAllowed`
 * @returns {*}
 */
Quota.prototype.isAllowed = function(req, res, files, callback) {

	if (!_.isArray(files)) {
		files = [ files ];
	}

	var plan = req.user._plan || quotaConfig.defaultPlan;

	// allow unlimited plans
	if (quotaConfig.plans[plan].unlimited === true) {
		return callback(null, true);
	}

	var file, sum = 0;
	for (var i = 0; i < files.length; i++) {
		file = files[i];
		var cost = Quota.prototype.getCost(file);

		// a free file
		if (cost === 0) {
			continue;
		}

		// deny access to anon (wouldn't be here if there were only free files)
		if (!req.user) {
			return callback(null, false);
		}

		if (!quotaConfig.plans[plan] && quotaConfig.plans[plan] !== 0) {
			return callback(error('No quota defined for plan "%s"', plan));
		}

		sum += cost;
	}

	// don't even check quota if weight is 0
	if (sum === 0) {
		return callback(null, true);
	}

	// https://github.com/apigee-127/volos/tree/master/quota/common#quotaapplyoptions-callback
	this.quota[quotaConfig.plans[plan].per].apply({
			identifier: req.user.id,
			weight: sum,
			allow: quotaConfig.plans[plan].credits
		},
		function(err, result) {
			if (err) {
				logger.error('[quota] Error checking quota for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			logger.info('[quota] Quota check for %s credit(s) %s on <%s> for %d file(s) with %d quota left for another %d seconds (plan allows %s per %s).', sum, result.isAllowed ? 'passed' : 'FAILED', req.user.email, files.length, result.allowed - result.used, Math.round(result.expiryTime / 1000), quotaConfig.plans[plan].credits, quotaConfig.plans[plan].per);
			res.set({
				'X-RateLimit-Limit': result.allowed,
				'X-RateLimit-Remaining': result.allowed - result.used,
				'X-RateLimit-Reset': result.expiryTime
			});
			callback(null, result.isAllowed);
		}
	);
};

/**
 * Returns the cost of a given file and variation.
 *
 * @param {File} file File
 * @param {string|object} [variation] Optional variation
 * @returns {*}
 */
Quota.prototype.getCost = function(file, variation) {

	if (!file.file_type) {
		logger.error(require('util').inspect(file));
		throw new Error('File object must be populated when retrieving costs.');
	}

	var variationName = _.isObject(variation) ? variation.name : variation;
	var cost = quotaConfig.costs[file.file_type];

	// undefined file_types are free
	if (_.isUndefined(cost)) {
		logger.warn('[quota] Undefined cost for file_type "%s".', file.file_type);
		return 0;
	}

	// if a variation is demanded and cost contains variation def, ignore the rest.
	if (variationName && !_.isUndefined(cost.variation)) {
		if (_.isObject(cost.variation)) {
			if (_.isUndefined(cost.variation[variationName])) {
				if (_.isUndefined(cost.variation['*'])) {
					logger.warn('[quota] No cost defined for %s file of variation %s and no fallback given, returning 0.', file.file_type, variationName);
					return 0;
				}
				cost = cost.variation['*'];
			} else {
				cost = cost.variation[variationName];
			}
		} else {
			return cost.variation;
		}
	}

	if (_.isObject(cost)) {
		if (_.isUndefined(cost.category)) {
			logger.warn('[quota] No cost defined for %s file (type is undefined).', file.file_type, file.getMimeCategory(variation));
			return 0;
		}
		if (_.isObject(cost.category)) {
			var costCategory = cost.category[file.getMimeCategory(variation)];
			if (_.isUndefined(costCategory)) {
				if (_.isUndefined(cost.category['*'])) {
					logger.warn('[quota] No cost defined for %s file of type %s and no fallback given, returning 0.', file.file_type, file.getMimeCategory(variation));
					return 0;
				}
				return cost.category['*'];
			}
			return costCategory;
		}
		return cost.category;
	}
	return cost;
};

module.exports = new Quota();