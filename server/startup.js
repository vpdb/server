'use strict';

var _ = require('underscore');
var async = require('async');
var logger = require('winston');

var storage = require('./modules/storage');
var quota = require('./modules/quota');

module.exports = function(done) {

	logger.info('[startup] Executing startup scripts...');

	// init quota
	quota.init();

	// cleanup inactive storage
	async.series([
		function(next) {
			logger.info('[startup] Cleaning up inactive storage files older than one hour.');
			storage.cleanup(3600000, next);
		}
	],
	done);
};