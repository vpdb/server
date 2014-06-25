'use strict';

var logger = require('winston');
var quotaModule = require('volos-quota-memory');

var plans = {
	logged: 5,
	bronze: 50,
	silver: 200,
	gold: 5000,
	root: -1
};

var costs = {
	'image/jpeg': 0,
	'image/png': 0,
	'application/zip': 1,
	'application/x-visual-pinball-table': 1,
	'video/mp4': 1,
	'video/x-flv': 1
};

exports.init = function() {
	logger.info('[quota] Initializing quotas...');
	this.quota = quotaModule.create({ timeUnit: 'day', interval: 1 });
};

exports.isAllowed = function(req, res, file, callback) {

	if (costs[file.mimeType] == null) {
		return callback('No cost defined for MIME type "' + file.mimeType + '".');
	}

	// return directly if file is free
	if (costs[file.mimeType] === 0) {
		return callback(null, true);
	}

	// deny access to anon (free files would have been served by now)
	if (!req.isAuthenticated()) {
		return callback(null, false);
	}

	var plan = req.user.plan ? req.user.plan : 'logged';
	if (plans[plan] == null) {
		return callback('No quota defined for plan "' + plan + '".');
	}

	// allow root
	if (plans[plan] === -1) {
		return callback(null, true);
	}

	this.quota.apply({
			identifier: req.user._id.toString(),
			weight: costs[file.mimeType],
			allow: plans[plan]
		},
		function(err, result) {
			if (err) {
				logger.error('[quota] Error checking quota for <%s>: %s', req.user.email, err, {});
				return res.status(500).end();
			}
			res.set({
				'X-RateLimit-Limit': result.allowed,
				'X-RateLimit-Remaining': result.allowed - result.used,
				'X-RateLimit-Reset': result.expiryTime
			});
			callback(null, result.isAllowed);
		}
	);
};