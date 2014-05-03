'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var reload = require('reload');
var domain = require('domain');
var express = require('express');
var passport = require('passport');

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

// load configurations
var config = require('./server/modules/settings');
var auth = require('./server/middleware/authorization');
var mongoose = require('mongoose');
var serverDomain = domain.create();
var Assets = require('./server/assets');
var app, assets;

// catch errors
serverDomain.run(function() {

	// bootstrap db connection
	mongoose.connect(config.get().vpdb.db);

	// bootstrap models
	var modelsPath = path.normalize(__dirname + '/server/models');
	fs.readdirSync(modelsPath).forEach(function(file) {
		require(modelsPath + '/' + file);
	});

	// bootstrap passport config
	//require('./server/passport')(passport, config.passport);

	app = express();
	assets = new Assets(app);

	// express settings
	require('./server/express')(app, config, passport, assets);

	// bootstrap routes
	require('./server/routes')(app, passport, auth, assets);

	// start the app by listening on <port>
	app.listen(app.get('port'), app.get('ipaddress'), function() {
		console.log('Express server listening at ' + app.get('ipaddress') + ':' + app.get('port'));
		if (process.send) {
			process.send('online');
		}
	});

	// expose app
	module.exports = app;
});

// gracefully shut down
process.on('message', function(message) {
	if (message === 'shutdown') {
		process.exit(0);
	}
});
