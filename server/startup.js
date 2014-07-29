"use strict";

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var async = require('async');
var logger = require('winston');

var storage = require('./modules/storage');
var quota = require('./modules/quota');

module.exports = function(done) {

	var asyncStartup = [];
	logger.info('[startup] Executing startup scripts...');

	// init quota
	quota.init();

	// cleanup inactive storage
	asyncStartup.push(function(next) {
		logger.info('[startup] Cleaning up inactive storage files older than one hour.');
		storage.cleanup(3600000, next);
	});

	// populate database
	var modelsPath = path.resolve(__dirname, '../data/database');
	fs.readdirSync(modelsPath).forEach(function(file) {
		if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
			var data = require(modelsPath + '/' + file);
			asyncStartup.push(function(next) {
				var Model = require('mongoose').model(data.model);

				// check if empty
				Model.count({}, function(err, num) {
					if (err) {
						return next(err);
					}
					if (num) {
						logger.info('[startup] Skipping data population for model "%s", table is not empty.', data.model);
						return next();
					}
					logger.info('[startup] Inserting %d rows into table "%s"..', data.rows.length, data.model);
					Model.collection.insert(data.rows, next);
				});
			});
		}
	});

	async.series(asyncStartup, done);
};