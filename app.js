'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var reload = require('reload');
var logger = require('winston');
var domain = require('domain');
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');

var settings = require('./server/modules/settings');
var auth = require('./server/middleware/authorization');

var app, config;
var serverDomain = domain.create();

// early init
require('./server/boostrap')();

// validate settings before continueing
if (!settings.validate()) {
	logger.error('[app] Settings validation failed, aborting.');
	process.exit(1);
} else {
	config = settings.current;
}

serverDomain.run(function() {

	app = express();

	// bootstrap db connection
	mongoose.connect(config.vpdb.db);

	// bootstrap models
	var modelsPath = path.resolve(__dirname, 'server/models');
	fs.readdirSync(modelsPath).forEach(function(file) {
		require(modelsPath + '/' + file);
	});

	// bootstrap passport config
	require('./server/passport')(passport, config.vpdb.passport);

	// express settings
	require('./server/express')(app, config, passport);

	// bootstrap routes
	require('./server/routes')(app, passport, auth);

	app.listen(app.get('port'), app.get('ipaddress'), function() {
		logger.info('[app] Express server listening at ' + app.get('ipaddress') + ':' + app.get('port'));
		if (process.send) {
			process.send('online');
		}
	});
});

process.on('message', function(message) {
	if (message === 'shutdown') {
		process.exit(0);
	}
});
