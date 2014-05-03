'use strict';

var http = require('http');
var path = require('path');

var reload = require('reload');
var domain = require('domain');
var express = require('express');

var settings = require('./server/modules/settings');
var Assets = require('./server/assets');

var serverDomain = domain.create();
var app;

serverDomain.run(function() {

	app = express();
	var assets = new Assets(app, server);

	// express settings
	var server = require('./server/express')(app, settings.current);

	// bootstrap routes
	require('./server/routes')(app, assets);

	server.listen(app.get('port'), app.get('ipaddress'), function() {
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
