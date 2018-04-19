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

// retrieve config for services
const { isAbsolute, resolve } = require('path');
const { existsSync } = require('fs');
const settingsPath = isAbsolute(process.env.APP_SETTINGS) ? process.env.APP_SETTINGS : resolve(process.cwd(), process.env.APP_SETTINGS);
const config = existsSync(settingsPath) ? require(settingsPath) : null;

// sqreen
if (config && config.vpdb.services && config.vpdb.services.sqreen && config.vpdb.services.sqreen.enabled) {
	process.env.SQREEN_TOKEN = config.vpdb.services.sqreen.token;
	require('sqreen');
}

// keymetrics.io
if (process.env.PMX_ENABLED) {
	require('pmx').init();
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

const settings = require('./src/modules/settings');
const serverDomain = domain.create();
let raygunClient = null;

// setup logger
require('./src/logging').init();

// setup raygun error handling
if (config && config.vpdb.services && config.vpdb.services.raygun && config.vpdb.services.raygun.enabled) {
	const raygun = require('raygun');
	const pkg = require('./package');
	raygunClient = new raygun.Client().init({ apiKey: config.vpdb.services.raygun.apiKey });
	raygunClient.setVersion(pkg.version);
	logger.info('[logging] Raygun crash logging enabled with API key %s', config.vpdb.services.raygun.apiKey);
	serverDomain.on('error', function(err){
		logger.info('[logging] Sending error to Raygun...');
		raygunClient.send(err, {}, function() {
			process.exit(1);
		});
	});
}

// validate settings before continueing
if (!settings.validate()) {
	logger.error('[app] Settings validation failed, aborting.');
	process.exit(1);
}

serverDomain.run(function() {

	logger.info('[app] Server location is at %s (CWD = %s)', path.resolve(__dirname), process.cwd());

	let app = express();

	const mongoOpts = {
		keepAlive: true,
		connectTimeoutMS: 5000
	};
	mongoose.connect(config.vpdb.db, mongoOpts).then(() => {

		const admin = new mongoose.mongo.Admin(mongoose.connection.db);
		admin.buildInfo((err, info) => {
			if (err) {
				logger.warn('[app] Database connected to MongoDB %s at %s (WARN: %s).', info ? info.version : 'unknown', config.vpdb.db, err.message);
			} else {
				logger.info('[app] Database connected to MongoDB %s at %s.', info ? info.version : 'unknown', config.vpdb.db);
			}
		});

		// bootstrap modules
		require('./src/modules/quota').init();
		require('./src/modules/storage').init();
		require('./src/modules/queue').init();

		// bootstrap models
		let modelsPath = path.resolve(__dirname, 'src/models');
		fs.readdirSync(modelsPath).forEach(function(file) {
			if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
				require(modelsPath + '/' + file);
			}
		});

		return require('./src/acl').init();

	}).then(() => {

		// bootstrap passport config
		require('./src/passport').configure();

		// express settings
		require('./src/express').configure(app, raygunClient);

		// other stuff
		return require('./src/startup').init();

	}).then(() => {

		// set log level
		logger.info('[app] Setting log level to "%s".', config.vpdb.logging.level);
		logger.level = config.vpdb.logging.level;

		// now we start the server.
		logger.info('[app] Starting Express server at %s:%d', app.get('ipaddress'), app.get('port'));
		app.listen(app.get('port'), app.get('ipaddress'), function() {
			logger.info('[app] Storage API ready at %s', settings.storageProtectedUri());
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
