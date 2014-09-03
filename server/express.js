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

var _ = require('lodash');
var path = require('path');
var http = require('http');
var logger = require('winston');

var passport = require('passport');
var express = require('express');
var jadeStatic = require('connect-jade-static');
var expressMorgan  = require('morgan');
var expressWinston = require('express-winston');
var expressBodyParser = require('body-parser');
var expressCompression = require('compression');
var expressErrorhandler = require('errorhandler');

// TODO re-enable
//var domainError = require('express-domain-errors');
//var gracefulExit = require('express-graceful-exit');

var config = require('./modules/settings').current;
var writeable = require('./modules/writeable');
var asset = require('./middleware/asset');
var ctrl = require('./controllers/ctrl');
var apiCtrl = require('./controllers/api/api');

exports.configure = function(app) {

	var runningLocal = !process.env.APP_NAME || (process.env.APP_NAME !== 'production' && process.env.APP_NAME !== 'staging');
	var runningDev = process.env.NODE_ENV !== 'production';

	logger.info('[express] Setting up Express for running %s in %s mode.', runningLocal ? 'locally' : 'remotely', runningDev ? 'development' : 'production');

	/* istanbul ignore if  */
	if (!process.env.PORT) {
		throw new Error('Environment variable `PORT` not found, server cannot start on unknown port.');
	}

	app.set('port', process.env.PORT);
	app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
	app.set('views', path.resolve(__dirname, '../client/views'));
	app.set('view engine', 'jade');
	app.set('json spaces', "\t");
	app.set('showStackError', runningDev);
	app.disable('x-powered-by');

	/* istanbul ignore if  */
	// add reverse proxy config for non-local
	if (!runningLocal) {
		app.enable('trust proxy');
	}

/*	app.use(domainError(sendOfflineMsg, function (err) {
		gracefulExit.gracefulExitHandler(app);
	}));*/

	/* istanbul ignore if  */
	// log to file if env APP_ACCESS_LOG is set
	if (process.env.APP_ACCESS_LOG) {
		app.use(expressWinston.logger({
			transports: [
				new logger.transports.File({
					level: 'info',                   // Level of messages that this transport should log.
					silent: false,                   // Boolean flag indicating whether to suppress output.
					colorize: false,                 // Boolean flag indicating if we should colorize output.
					timestamp: true,                 // Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
					filename: process.env.APP_ACCESS_LOG,  // The filename of the logfile to write output to.
					maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
					maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
					stream: null,                    // The WriteableStream to write output to.
					json: false                      // If true, messages will be logged as JSON (default true).
				})
			],
			meta: false, // optional: control whether you want to log the meta data about the request (default to true)
			msg: '[http] {{req.ip}}: {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms' // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
		}));
		logger.info('[express] Access log will be written to %s.', process.env.APP_ACCESS_LOG);
	} else {
		app.use(expressMorgan('dev'));
	}

	if (runningLocal) {
		// in production the reverse proxy is taking care of this
		app.use(expressCompression({ filter: function(req, res) { return /json|text|javascript|css/.test(res.getHeader('Content-Type')); }, level: 9 }));
	}

	// general stuff
	app.use(expressBodyParser.json());

	// static file serving
	// markup (which is pre-compiled in production)
	app.use(jadeStatic({
		baseDir: path.resolve(__dirname, '../client/views'),
		baseUrl: '/',
		jade: _.extend(ctrl.viewParams(), {
			pretty: true
		})
	}));
	// other static files
	app.use(express.static(writeable.cacheRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(writeable.buildRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static/images/favicon'), { maxAge: 3600*24*30*1000 }));
	app.use('/js', express.static(path.resolve(__dirname, '../client/code'), { maxAge: 3600*24*30*1000 }));

	// mock
	app.use(express.static(path.resolve(__dirname, '../data/assets'), { maxAge: 3600*24*30*1000 }));
	app.use(asset.middleware());

	// initialize passport
	app.use(passport.initialize());

	// api pre-checks
	app.use(apiCtrl.checkApiContentType);

	app.use('/styleguide', express.static(path.resolve(__dirname, '../styleguide')));

	// dynamic routes
	require('./routes')(app);

	// api errors
	app.use(apiCtrl.handleParseError);

	// error logger comes at the very last
	app.use(expressWinston.errorLogger({
		transports: [
			new logger.transports.Console({ json: false, colorize: true })
		]
	}));

	/* istanbul ignore if  */
	// production only
	if (!runningDev) {
		http.globalAgent.maxSockets = 500; // set this high, if you use httpClient or request anywhere (defaults to 5)
	}

	// development only
	if (runningDev) {
		app.use(expressErrorhandler());
		app.locals.pretty = true;
	}

	if (runningLocal) {
		// kill switch for CI
		logger.warn('[express] Enabling kill switch for continueous integration.');
		/* istanbul ignore next  */
		app.post('/kill', function(req, res) {
			res.status(200).end();
			process.exit(0);
		});
	}

	// add the coverage handler
	if (process.env.COVERAGE) {
		//enable coverage endpoints under /coverage
		app.use('/_coverage', require('istanbul-middleware').createHandler());
		app.use('/coverage', express.static(path.resolve(__dirname, '../test/coverage/lcov-report'), { maxAge: 3600*24*30*1000 }));
	}

	// per default, serve index and let Angular.JS figure out if it's a valid route (nginx does this in production).
	app.use(function(req, res) {
		res.status(200).render('index',  _.extend(ctrl.viewParams(), {
			pretty: true
		}));
	});

	// assume "not found" in the error msgs
	// is a 404. this is somewhat silly, but
	// valid, you can do whatever you like, set
	// properties, use instanceof etc.
	app.use(function(err, req, res, next) {
		// treat as 404
		if (~err.message.indexOf('not found')) {
			return next();
		}
		logger.error('[express] %s', err.stack);

		// error page
		ctrl.renderError(500, 'Internal Server Error.')(req, res);
	});

	// assume 404 since no middleware responded
	app.use(ctrl.renderError(404, 'Not found.'));
};

//function sendOfflineMsg() {
//	if (process.send) {
//		process.send('offline');
//	}
//}