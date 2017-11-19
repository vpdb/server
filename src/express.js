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
const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('winston');
const passport = require('passport');
const express = require('express');
const pugStatic = require('./modules/connect-pug-static');
const expressWinston = require('express-winston');
const expressBodyParser = require('body-parser');
const expressCompression = require('compression');
const expressErrorhandler = require('errorhandler');

const settings = require('./modules/settings');
const writeable = require('./modules/writeable');
const gitinfo = require('./modules/gitinfo');
const ctrl = require('./controllers/ctrl');
const apiCtrl = require('./controllers/api/api');
const logging = require('./logging');

exports.configure = function(app, raygunClient) {

	const runningLocal = !process.env.APP_NAME || (process.env.APP_NAME !== 'production' && process.env.APP_NAME !== 'staging');
	const runningDev = process.env.NODE_ENV !== 'production';
	const runningTest = process.env.NODE_ENV === 'test';
	const ipAddress = process.env.IPADDRESS || '127.0.0.1';
	const staticWebApp = process.env.WEBAPP ? path.resolve(__dirname, '../..', process.env.WEBAPP) : null;

	logger.info('[express] Setting up Express for running %s in %s mode.', runningLocal ? 'locally' : 'remotely', runningDev ? 'development' : 'production');

	/* istanbul ignore if  */
	if (!process.env.PORT) {
		throw new Error('Environment variable `PORT` not found, server cannot start on unknown port.');
	}

	app.set('ipaddress', ipAddress);
	app.set('port', process.env.PORT);
	app.set('json spaces', '\t');
	app.set('showStackError', runningDev);
	app.disable('x-powered-by');

	/* istanbul ignore if  */
	// add reverse proxy config for non-local
	if (!runningLocal) {
		app.enable('trust proxy');
	}

	if (runningLocal) {
		// in production the reverse proxy is taking care of this
		app.use(expressCompression({ filter: function(req, res) { return /json|text|javascript|css/.test(res.getHeader('Content-Type')); }, level: 9 }));

		// setup CORS
		const cors = require('cors');
		app.use(cors({
			exposedHeaders: 'Cache-Control,Link,X-App-Sha,X-Token-Refresh,X-User-Dirty,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,X-List-Count,X-List-Page,X-List-Size' }));
	}

	// general stuff
	app.use(expressBodyParser.json());

	// initialize passport
	app.use(passport.initialize());

	// setup logging
	logging.expressConfig(app);

	// api pre-checks
	app.use(apiCtrl.checkApiContentType);

	app.use('/styleguide', express.static(path.resolve(__dirname, '../styleguide')));

	// git sha header
	app.use(function(req, res, next) {
		res.set({ 'X-App-Sha': gitinfo.info.local.branch.current.shortSHA });
		next();
	});

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

	// travis / saucelab webapp. Run with:
	// set PORT=4445
	// set APP_SETTINGS=c:\dev\vpdb-backend\src\config\settings-sauce.js
	// set NODE_ENV=test
	// set WEBAPP=vpdb-website/dist
	if (runningTest) {
		if (staticWebApp && fs.existsSync(staticWebApp)) {
			logger.info('[express] Serving static webapp at %s...', staticWebApp);
			app.use(express.static(staticWebApp));
			app.use('/*', (req, res) => res.sendfile(staticWebApp + '/index.html'));

		} else if (staticWebApp) {
			logger.warn('[express] Ignoring WEBAPP parameter "%", "%" does not exist.', process.env.WEBAPP, staticWebApp);
		}
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
};

//function sendOfflineMsg() {
//	if (process.send) {
//		process.send('offline');
//	}
//}