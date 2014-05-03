var path = require('path');
var http = require('http');
var express = require('express');

var domainError = require('express-domain-errors');
var gracefulExit = require('express-graceful-exit');

var writeable = require('./modules/writeable');
var asset = require('./middleware/asset');

module.exports = function(app, config, passport) {

	// all environments
	app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
	app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
	app.set('views', path.resolve(__dirname, '../client/views'));
	app.set('view engine', 'jade');
	app.use(domainError(sendOfflineMsg, doGracefulExit));
	app.use(express.logger('dev'));
//	app.use(express.compress());
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(express.static(path.resolve(__dirname, '../client/static'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(writeable.cacheRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../data/assets'), { maxAge: 3600*24*30*1000 }));
	app.use(asset.middleware());
	app.use(app.router);

	/**
	 * Start Server
	 */
	var server = http.createServer(app).on('error', function(e) {

		// do not fail silently on error, particularly annoying in development.
		if (e.code == 'EADDRINUSE') {
			console.log('Failed to bind to port - address already in use ');
			process.exit(1);
		}
	});

	// production only
	if (app.get('env') === 'production') {
		http.globalAgent.maxSockets = 500; // set this high, if you use httpClient or request anywhere (defaults to 5)
	}

	// development only
	if (app.get('env') === 'development') {
		app.use(express.errorHandler());
		app.configure('development', function() {
			app.use(express.errorHandler());
			app.locals.pretty = true;
//			assets.liveUpdate();
		});
	}

	return server;
};


function sendOfflineMsg() {
	if (process.send) {
		process.send('offline');
	}
}
function doGracefulExit(err) {
	gracefulExit.gracefulExitHandler(app, server);
}
