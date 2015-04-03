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

var path = require('path');
var logger = require('winston');
var papertrail = require('winston-papertrail').Papertrail; // only needs to require, no usage.
var expressMorgan  = require('morgan');
var expressWinston = require('express-winston');

var config = require('./modules/settings').current;

// application log
exports.init = function() {

	// we're here before settings validation, so lazy-validate first.
	if (!config.vpdb || !config.vpdb.logging || !config.vpdb.logging.console ||
		!config.vpdb.logging.file || !config.vpdb.logging.papertrail) {
		return;
	}

	// clear current loggers
	logger.remove(logger.transports.Console);

	// console
	if (config.vpdb.logging.console.app) {
		logger.add(logger.transports.Console, {
			level: 'info',   // Level of messages that this transport should log (default 'info').
			silent: false,   // Boolean flag indicating whether to suppress output (default false).
			colorize: true,  // Boolean flag indicating if we should colorize output (default false).
			timestamp: true  // Boolean flag indicating if we should prepend output with timestamps (default false). If function is specified, its return value will be used instead of timestamps.
		});
	}

	// file
	if (config.vpdb.logging.file.app) {
		var logPath = path.resolve(config.vpdb.logging.file.app);
		logger.add(logger.transports.File, ({
			level: 'info',                   // Level of messages that this transport should log.
			silent: false,                   // Boolean flag indicating whether to suppress output.
			colorize: false,                 // Boolean flag indicating if we should colorize output.
			timestamp: true,                 // Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
			filename: logPath,               // The filename of the logfile to write output to.
			maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
			maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
			stream: null,                    // The WriteableStream to write output to.
			json: false                      // If true, messages will be logged as JSON (default true).
		}));
		logger.info('[logging] Application log is written to %s.', logPath);
	}

	// papertrail
	if (config.vpdb.logging.papertrail.app) {
		logger.add(logger.transports.Papertrail, config.vpdb.logging.papertrail.options);
		logger.info('[logging] Papertrail application log enabled for %s:%d', config.vpdb.logging.papertrail.options.host, config.vpdb.logging.papertrail.options.port);
	}

};

// access log
exports.expressConfig = function(app) {

	var transports = [];

	// console
	if (config.vpdb.logging.console.access) {
		expressMorgan.token('colorReq', function(req) {
			var str = req.method + ' ' + (req.originalUrl || req.url);
			switch (req.method) {
				case 'GET':    return str.white.blueBG;
				case 'POST':   return str.white.greenBG;
				case 'PUT':    return str.white.yellowBG;
				case 'DELETE': return str.white.redBG;
				default:       return str.white.greyBG;
			}
		});
		app.use(expressMorgan(':date[iso] :colorReq :status :response-time ms - :res[content-length]'));
	}

	// file
	if (config.vpdb.logging.file.access) {
		var logPath = path.resolve(config.vpdb.logging.file.access);
		transports.push(new logger.transports.File({
			level: 'info',                   // Level of messages that this transport should log.
			silent: false,                   // Boolean flag indicating whether to suppress output.
			colorize: false,                 // Boolean flag indicating if we should colorize output.
			timestamp: true,                 // Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
			filename: logPath,               // The filename of the logfile to write output to.
			maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
			maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
			stream: null,                    // The WriteableStream to write output to.
			json: false                      // If true, messages will be logged as JSON (default true).
		}));
		logger.info('[logging] Access log will be written to %s.', logPath);
	}

	// papertrail
	if (config.vpdb.logging.papertrail.access) {
		transports.push(new logger.transports.Papertrail(config.vpdb.logging.papertrail.options));
		logger.info('[logging] Papertrail access log enabled for %s:%d', config.vpdb.logging.papertrail.options.host, config.vpdb.logging.papertrail.options.port);
	}

	if (transports.length > 0) {
		app.use(expressWinston.logger({
			transports: transports,
			meta: false, // optional: control whether you want to log the meta data about the request (default to true)
			msg: '[http] {{req.ip}}: {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms' // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
		}));
	}
};