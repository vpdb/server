"use strict";

if (process.env.NEW_RELIC_ENABLED) {
	require('newrelic');
}

var fs = require('fs');
var path = require('path');
var util = require('util');
var logger = require('winston');
var domain = require('domain');
var express = require('express');
var mongoose = require('mongoose');

if (process.env.COVERAGE_ENABLED) {
	console.log('[app] Hook loader for coverage enabled.');
	require('istanbul-middleware').hookLoader(__dirname);
	// cover all files except under node_modules
	// see API for other options
}

var settings = require('./server/modules/settings');
var serverDomain = domain.create();

// setup logger
require('./server/logging').init();

// validate settings before continueing
if (!settings.validate()) {
	logger.error('[app] Settings validation failed, aborting.');
	process.exit(1);
} else {
	var config = settings.current;
}


serverDomain.run(function() {

	logger.info('[app] Server location is at %s (CWD = %s)', path.resolve(__dirname), process.cwd());

	var app = express();

	// bootstrap db connection
	mongoose.connect(config.vpdb.db, { server: { socketOptions: { keepAlive: 1 } } });
	logger.info('[app] Database connected to %s.', config.vpdb.db);

	// bootstrap models
	var modelsPath = path.resolve(__dirname, 'server/models');
	fs.readdirSync(modelsPath).forEach(function(file) {
		if (!fs.lstatSync(modelsPath + '/' + file).isDirectory()) {
			require(modelsPath + '/' + file);
		}
	});

	// load ACLs
	require('./server/acl').init(function(err) {

		if (err) {
			logger.error('[app] Aborting.');
			return process.exit(1);
		}

		try {
			// bootstrap passport config
			require('./server/passport').configure();

			// express settings
			require('./server/express').configure(app);

		} catch (e) {
			logger.error('[app] ERROR: %s', e.message);
			// dunno why the fuck it doesn't print the stack otherwise.
			return setTimeout(function() {
				logger.error('[app] STACK: %s', e.stack);
				process.exit(1);
			}, 0);
		}

		// and lastly, startup scripts - stuff that is run at start.
		require('./server/startup').init(function(err) {

			if (err) {
				logger.error('[app] Error executing startup scripts: %s', err);
				return process.exit(1);
			}

			// now we start the server.
			logger.info('[app] Starting Express server at %s:%d', app.get('ipaddress'), app.get('port'));
			app.listen(app.get('port'), app.get('ipaddress'), function() {
				logger.info('[app] Web application ready at %s', settings.webUri());
				logger.info('[app] API ready at %s', settings.apiUri());
				if (process.send) {
					process.send('online');
				}
			});
		});
	});
});

process.on('message', function(message) {
	if (message === 'shutdown') {
		process.exit(0);
	}
});
