'use strict';

var http = require('http');
var path = require('path');

var reload = require('reload');
var domain = require('domain');
var express = require('express');
var domainError = require('express-domain-errors');
var gracefulExit = require('express-graceful-exit');

var api = require('./server/routes/api');
var routes = require('./server/routes');
var asset = require('./server/middleware/asset');
var Assets = require('./server/assets');

var serverDomain = domain.create();
var app;


function sendOfflineMsg() {
	if (process.send) {
		process.send('offline');
	}
}
function doGracefulExit(err) {
	gracefulExit.gracefulExitHandler(app, server)
}

serverDomain.run(function() {

	app = express();

	/**
	 * Configuration
	 */

	// all environments
	app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
	app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
	app.set('views', path.join(__dirname, 'client', 'views'));
	app.set('view engine', 'jade');
	app.use(domainError(sendOfflineMsg, doGracefulExit));
	app.use(express.logger('dev'));
//	app.use(express.compress());
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/client/static', { maxAge: 3600*24*30*1000 }));
	app.use(express.static(__dirname + '/data/assets', { maxAge: 3600*24*30*1000 }));
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

	var assets = new Assets(app, server);
	app.configure(assets.configure);

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

	/**
	 * Routes
	 */
	app.get('/', assets.renderIndex);
	app.get('/games', assets.renderIndex);
	app.get('/game', assets.renderIndex);
	app.get('/game/*', assets.renderIndex);
	app.get('/home', assets.renderIndex);

	// serve index and view partials
	app.get('/partials/:name', routes.partials);
	app.get('/partials/modals/:name', routes.modals);

	// JSON API
	app.get('/api/games/:id', api.game);
	app.get('/api/games', api.games);
	app.get('/api/packs', api.packs);
	app.get('/api/releases', api.releases);
	app.get('/api/feed', api.feed);
	app.get('/api/users', api.users);
	app.get('/api/users/:user', api.user);

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
