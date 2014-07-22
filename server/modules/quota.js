'use strict';

var logger = require('winston');
var quotaModule = require('volos-quota-memory');
var quotaConfig = require('./settings').current.vpdb.quota;

// TODO remove init and put logic into constructor.
exports.init = function() {
	logger.info('[quota] Initializing quotas...');
	var duration;
	this.quota = {};
	// we create a quota module for each duration
	for (var plan in quotaConfig.plans) {
		if (quotaConfig.plans[plan].unlimited) {
			continue;
		}
		duration = quotaConfig.plans[plan].per;
		if (!this.quota[duration]) {
			logger.info('[quota] Creating quota for credits per %s...', duration);
			this.quota[duration] = quotaModule.create({ timeUnit: duration, interval: 1 });
		}
	}
};

exports.isAllowed = function(req, res, file, callback) {

	// undefined mime types are free
	if (quotaConfig.costs[file.mime_type] == null) {
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

	var plan = req.user.plan ? req.user.plan : quotaConfig.defaultPlan;
	if (quotaConfig.plans[plan] == null) {
		return callback('No quota defined for plan "' + plan + '".');
	}

	// allow unlimited plans
	if (quotaConfig.plans[plan].unlimited === true) {
		return callback(null, true);
	}

	this.quota[quotaConfig.plans[plan].per].apply({
			identifier: req.user._id,
			weight: quotaConfig.costs[file.mime_type],
			allow: quotaConfig.plans[plan].credits
		},
		function(err, result) {
			if (err) {
				logger.error('[quota] Error checking quota for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			logger.info('[quota] Quota check %s on <%s> for %s with %d quota left for another %d seconds.', result.isAllowed ? 'passed' : 'FAILED', req.user.email, file._id, result.allowed - result.used, Math.round(result.expiryTime / 1000));
			res.set({
				'X-RateLimit-Limit': result.allowed,
				'X-RateLimit-Remaining': result.allowed - result.used,
				'X-RateLimit-Reset': result.expiryTime
			});
			callback(null, result.isAllowed);
		}
	);
};