'use strict';

var http = require('http');
var path = require('path');
var piler = require('piler');
var reload = require('reload');
var express = require('express');

var api = require('./server/routes/api');
var routes = require('./server/routes');
var asset = require('./server/middleware/asset');

var app = express();
var clientjs = piler.createJSManager({
	outputDirectory: __dirname + "/gen/js",
	urlRoot: "/js/"
});
var clientcss = piler.createCSSManager({
	outputDirectory: __dirname + "/gen/css",
	urlRoot: "/css/"
});

var gracefullyClosing = false;


/**
 * Configuration
 */

// all environments
app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
app.set('views', path.join(__dirname, 'client', 'views'));
app.set('view engine', 'jade');
app.use(function(req, res, next) {
	if (!gracefullyClosing) {
		return next();
	}
	res.setHeader("Connection", "close");
	return res.send(502, "Server is in the process of restarting");
});
app.use(express.logger('dev'));
app.use(express.compress());
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.static(__dirname + '/client/static', { maxAge: 3600*24*30*1000 }));
app.use(express.static(__dirname + '/data/assets', { maxAge: 3600*24*30*1000 }));
app.use(asset.middleware());
app.use(app.router);


// production only
if (app.get('env') === 'production') {
	// TODO
}

/**
 * Start Server
 */
var server = http.createServer(app);

app.configure(function() {

	clientjs.bind(app, server);
	clientcss.bind(app, server);

	clientcss.addFile(__dirname + "/client/static/css/lib/bootstrap-3.1.1.css");
	clientcss.addFile(__dirname + "/client/static/css/lib/font-awesome.css");
	clientcss.addFile(__dirname + "/client/static/css/lib/magnific-popup.css");
	clientcss.addFile(__dirname + "/client/static/css/lib/nanoscroller.css");
	clientcss.addFile(__dirname + "/client/static/css/fonts.css");
	clientcss.addFile(__dirname + "/client/css/app.styl");
	clientcss.addFile(__dirname + "/client/css/colors.styl");
	clientcss.addFile(__dirname + "/client/css/animations.styl");

	clientjs.addFile(__dirname + "/client/code/lib/jquery-2.1.0.js");
	clientjs.addFile(__dirname + "/client/code/lib/angular-1.3.0-beta.3/angular.js");
	clientjs.addFile(__dirname + "/client/code/lib/angular-1.3.0-beta.3/angular-route.js");
	clientjs.addFile(__dirname + "/client/code/lib/angular-1.3.0-beta.3/angular-animate.js");
	clientjs.addFile(__dirname + "/client/code/lib/angular-1.3.0-beta.3/angular-sanitize.js");
	clientjs.addFile(__dirname + "/client/code/lib/angulartics-0.14.15/angulartics.js");
	clientjs.addFile(__dirname + "/client/code/lib/angulartics-0.14.15/angulartics-ga.js");
	clientjs.addFile(__dirname + "/client/code/lib/angulartics-0.14.15/angulartics-ga-cordova.js");
	clientjs.addFile(__dirname + "/client/code/lib/ui-bootstrap-tpls-0.10.0.js");
	clientjs.addFile(__dirname + "/client/code/lib/underscore-1.6.0.js");
	clientjs.addFile(__dirname + "/client/code/lib/showdown.js");
	clientjs.addFile(__dirname + "/client/code/lib/jquery.magnific-popup-0.9.9.js");
	clientjs.addFile(__dirname + "/client/code/lib/jquery.nanoscroller-0.8.0.js");
	clientjs.addFile(__dirname + "/client/code/lib/jquery.waitforimages-1.5.0.js");
	clientjs.addFile(__dirname + "/client/code/lib/angular.scrollable-0.2.0.js");
	clientjs.addFile(__dirname + "/client/code/app.js");
	clientjs.addFile(__dirname + "/client/code/services.js");
	clientjs.addFile(__dirname + "/client/code/controllers.js");
	clientjs.addFile(__dirname + "/client/code/filters.js");
	clientjs.addFile(__dirname + "/client/code/directives.js");
	clientjs.addFile(__dirname + "/client/code/controller/home.js");
	clientjs.addFile(__dirname + "/client/code/controller/games.js");
	clientjs.addFile(__dirname + "/client/code/controller/game.js");
	clientjs.addFile(__dirname + "/client/code/service/timeago.js");
	clientjs.addFile(__dirname + "/client/code/directive/timeago.js");
	clientjs.addFile(__dirname + "/client/code/directive/elastic.js");
});

// development only
if (app.get('env') === 'development') {
	app.use(express.errorHandler());
	app.configure('development', function() {
		app.use(express.errorHandler());
		app.locals.pretty = true;
		clientjs.liveUpdate(clientcss);
	});
}

var index = function(req, res){
	res.render('index', {
		layout: false,
		js: clientjs.renderTags(),
		css: clientcss.renderTags()
	});
};

/**
 * Routes
 */
app.get('/', index);
app.get('/games', index);
app.get('/game', index);
app.get('/game/*', index);
app.get('/home', index);

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
});


// gracefully shutdown on SIGTERM
process.on('SIGTERM', function() {
	gracefullyClosing = true;
	console.log("Received kill signal (SIGTERM), shutting down gracefully.");
	server.close(function() {
		console.log("Closed out remaining connections.");
		return process.exit();
	});

	// create a timeout that forcefully exits the process if connections are taking an unreasonable
	// amount of time to close
	return setTimeout(function() {
		console.error("Could not close connections in time, forcefully shutting down");
		return process.exit(1);
	}, 30 * 1000);
});
