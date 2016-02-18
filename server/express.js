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
var path = require('path');
var http = require('http');
var logger = require('winston');
var passport = require('passport');
var express = require('express');
var jadeStatic = require('connect-jade-static');
var expressWinston = require('express-winston');
var expressBodyParser = require('body-parser');
var expressCompression = require('compression');
var expressErrorhandler = require('errorhandler');

// TODO re-enable
//var domainError = require('express-domain-errors');
//var gracefulExit = require('express-graceful-exit');

var settings = require('./modules/settings');
var writeable = require('./modules/writeable');
var ctrl = require('./controllers/ctrl');
var apiCtrl = require('./controllers/api/api');
var logging = require('./logging');

exports.configure = function(app, raygunClient) {

	var runningLocal = !process.env.APP_NAME || (process.env.APP_NAME !== 'production' && process.env.APP_NAME !== 'staging');
	var runningDev = process.env.NODE_ENV !== 'production';
	var ipAddress = process.env.IPADDRESS || '127.0.0.1';

	logger.info('[express] Setting up Express for running %s in %s mode.', runningLocal ? 'locally' : 'remotely', runningDev ? 'development' : 'production');

	/* istanbul ignore if  */
	if (!process.env.IPADDRESS) {
		throw new Error('Environment variable `IPADDRESS` not found, server cannot start on unknown ip address.');
	}
	
	/* istanbul ignore if  */
	if (!process.env.PORT) {
		throw new Error('Environment variable `PORT` not found, server cannot start on unknown port.');
	}

	app.set('ipaddress', ipAddress);
	app.set('port', process.env.PORT);
	app.set('views', path.resolve(__dirname, '../client/app'));
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

	if (runningLocal) {
		// in production the reverse proxy is taking care of this
		app.use(expressCompression({ filter: function(req, res) { return /json|text|javascript|css/.test(res.getHeader('Content-Type')); }, level: 9 }));
	}

	// general stuff
	app.use(expressBodyParser.json());

	// static file serving
	// markup (which is pre-compiled in production)
	app.use(/.*\.html$/i, jadeStatic({
		baseDir: path.resolve(__dirname, '../client/app'),
		baseUrl: '/',
		jade: _.extend(ctrl.viewParams(), {
			pretty: true
		})
	}));

	// other static files
	app.use(express.static(writeable.buildRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static/images/favicon'), { maxAge: 3600*24*30*1000 }));
	app.use('/js', express.static(path.resolve(__dirname, '../client/app'), { maxAge: 3600*24*30*1000 }));
	app.use('/js/config.js', express.static(path.resolve(writeable.jsRoot, settings.clientConfigName()), { maxAge: 3600 * 24 * 30 * 1000 }));

	// only for the source map, see https://github.com/gruntjs/grunt-contrib-stylus/pull/117
	if (runningLocal) {
		app.use('/css/client/styles/vpdb.css.map', express.static(path.resolve(writeable.buildRoot, 'css/vpdb.css.map'), { maxAge: 3600 * 24 * 30 * 1000 }));
		app.use('/css/client/styles', express.static(path.resolve(__dirname, '../client/styles'), { maxAge: 3600 * 24 * 30 * 1000 }));
	}

	// initialize passport
	app.use(passport.initialize());

	// setup logging
	logging.expressConfig(app);

	// api pre-checks
	app.use(apiCtrl.checkApiContentType);

	app.use('/styleguide', express.static(path.resolve(__dirname, '../styleguide')));

	// dynamic routes
	require('./routes')(app);

	// api errors
	app.use(apiCtrl.handleParseError);

	/* istanbul ignore if: Raygun not running during tests */
	if (raygunClient) {
		app.use(raygunClient.expressHandler);
		raygunClient.user = function(req) {
			if (req && req.user) {
				return req.user.email;
			}
		};
	}

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
		app.locals.pretty = false;
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
	if (process.env.COVERAGE_ENABLED) {
		//enable coverage endpoints under /coverage
		app.use('/_coverage', require('istanbul-middleware').createHandler());
		app.use('/coverage', express.static(path.resolve(__dirname, '../test/coverage/lcov-report'), { maxAge: 3600*24*30*1000 }));
	}

	// per default, serve index and let Angular.JS figure out if it's a valid route (nginx does this in production).
	app.use(function(req, res) {
		/* istanbul ignore else: Managed by Nginx in production. */
		if (!/\.html$/.test(req.path)) {
			res.status(200).render('index',  _.extend(ctrl.viewParams(), {
				pretty: true
			}));
		} else {
			res.status(404).end();
		}
	});
};

//function sendOfflineMsg() {
//	if (process.send) {
//		process.send('offline');
//	}
//}