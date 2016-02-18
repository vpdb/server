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

// keymetrics.io http analysis
if (process.env.PMX_ENABLED) {
	require('pmx').init();
}

// new relic profiling
if (process.env.NEW_RELIC_ENABLED) {
	require('newrelic');
}

const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('winston');
const domain = require('domain');
const express = require('express');
const mongoose = require('mongoose');

require('shortid32').characters('123456789abcdefghkmnopqrstuvwxyz');

// override standard promises
Promise = require('bluebird');
mongoose.Promise = Promise;

if (process.env.COVERAGE_ENABLED) {
	console.log('[app] Hook loader for coverage enabled.');
	require('istanbul-middleware').hookLoader(__dirname);
	// cover all files except under node_modules
	// see API for other options
}

const settings = require('./server/modules/settings');
const serverDomain = domain.create();

// setup logger
require('./server/logging').init();

// setup raygun error handling
if (process.env.RAYGUN_API_KEY) {
	let raygun = require('raygun');
	let raygunClient = new raygun.Client().init({ apiKey: process.env.RAYGUN_API_KEY });
	logger.info('[logging] Raygun crash logging enabled with API key %s', process.env.RAYGUN_API_KEY);
	serverDomain.on('error', function(err){
		logger.info('[logging] Sending error to Raygun...');
		raygunClient.send(err, {}, function() {
			process.exit();
		});
	});
}

// validate settings before continueing
if (!settings.validate()) {
	logger.error('[app] Settings validation failed, aborting.');
	process.exit(1);
} else {
	var config = settings.current;
}

serverDomain.run(function() {

	logger.info('[app] Server location is at %s (CWD = %s)', path.resolve(__dirname), process.cwd());

	let app = express();

	new Promise((resolve, reject) => {
		// bootstrap db connection
		let mongoOpts = { server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 5000 } }, auto_reconnect: true };
		mongoose.connection.on('open', function() {
			logger.info('[app] Database connected to %s.', config.vpdb.db);
			resolve();
		});
		mongoose.connection.on('error', function (err) {
			logger.error('[app] Database connection failed: %s.', err.message);
			reject(err);
		});
		mongoose.connection.on('disconnected', function() {
			logger.error('[app] Database disconnected, trying to reconnect...');
			mongoose.connect(config.vpdb.db, mongoOpts);
		});
		mongoose.connect(config.vpdb.db, mongoOpts);

	}).then(() => {

		// bootstrap models
		let modelsPath = path.resolve(__dirname, 'server/models');
		fs.readdirSync(modelsPath).forEach(function(file) {
			if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
				require(modelsPath + '/' + file);
			}
		});

		return require('./server/acl').init();

	}).then(() => {

		// bootstrap passport config
		require('./server/passport').configure();

		// express settings
		require('./server/express').configure(app, raygunClient);

		// other stuff
		return require('./server/startup').init();

	}).then(() => {

		// now we start the server.
		logger.info('[app] Starting Express server at %s:%d', app.get('ipaddress'), app.get('port'));
		app.listen(app.get('port'), app.get('ipaddress'), function() {
			logger.info('[app] Web application ready at %s', settings.webUri());
			logger.info('[app] API ready at %s', settings.apiUri());
			if (process.send) {
				process.send('online');
			}
		});

	}).catch(err => {
		logger.error('[app] ERROR: %s', err.message);
		// dunno why the fuck it doesn't print the stack otherwise.
		return setTimeout(function() {
			logger.error('[app] STACK: %s', err.stack);
			process.exit(1);
		}, 0);
	});
});
