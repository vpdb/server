'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');
var reload = require('reload');
var domain = require('domain');
var express = require('express');
var passport = require('passport');
var mongoose = require('mongoose');

var config = require('./server/modules/settings').current;
var auth = require('./server/middleware/authorization');

var app;
var serverDomain = domain.create();

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
		console.log('Express server listening at ' + app.get('ipaddress') + ':' + app.get('port'));
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
