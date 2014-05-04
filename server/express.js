var path = require('path');
var http = require('http');
var flash = require('connect-flash');
var express = require('express');
var mongoStore = require('connect-mongo')(express);

var domainError = require('express-domain-errors');
var gracefulExit = require('express-graceful-exit');

var writeable = require('./modules/writeable');
var asset = require('./middleware/asset');

module.exports = function(app, config, passport) {

	var runningLocal = !process.env.APP_NAME || (process.env.APP_NAME != 'production' && process.env.APP_NAME != 'staging');
	var runningDev = process.env.NODE_ENV != 'production';

	console.log('Setting up Express for running %s in %s mode.', runningLocal ? 'locally' : 'remotely', runningDev ? 'development' : 'production');

	app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
	app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
	app.set('views', path.resolve(__dirname, '../client/views'));
	app.set('view engine', 'jade');
	app.set('showStackError', runningDev);

	app.use(domainError(sendOfflineMsg, doGracefulExit));
	app.use(express.logger('dev'));
	if (runningLocal) {
		// in production the reverse proxy is taking care of this
		app.use(express.compress({ filter: function(req, res) { return /json|text|javascript|css/.test(res.getHeader('Content-Type')); }, level: 9 }));
	}

	// general stuff
	app.use(express.cookieParser());   // cookieParser should be above session
	app.use(express.json());           // bodyParser should be above methodOverride
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(express.favicon());

	// static file serving
	app.use(express.static(writeable.cacheRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/code'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../data/assets'), { maxAge: 3600*24*30*1000 }));
	app.use(asset.middleware());

	// express/mongo session storage
	app.use(express.session({
		secret: config.vpdb.secret,
		store: new mongoStore({
			url: config.vpdb.db,
			collection: 'sessions'
		})
	}));

	// connect flash for flash messages
	app.use(flash());

	// use passport session
	app.use(passport.initialize());
	app.use(passport.session());

	// routes should be at the last
	app.use(app.router);

	// production only
	if (!runningDev) {
		http.globalAgent.maxSockets = 500; // set this high, if you use httpClient or request anywhere (defaults to 5)
	}

	// development only
	if (runningDev) {
		app.use(express.errorHandler());
		app.locals.pretty = true;
	}

	// assume "not found" in the error msgs
	// is a 404. this is somewhat silly, but
	// valid, you can do whatever you like, set
	// properties, use instanceof etc.
	app.use(function(err, req, res, next) {
		// treat as 404
		if (~err.message.indexOf('not found')) {
			return next();
		}
		console.error(err.stack);

		// error page
		res.status(500).render('500', { error: err.stack });
	});

	// assume 404 since no middleware responded
	app.use(function(req, res) {
		res.status(404).render('404', { url: req.originalUrl, error: 'Not found' })
	});
};

function sendOfflineMsg() {
	if (process.send) {
		process.send('offline');
	}
}
function doGracefulExit(err) {
	gracefulExit.gracefulExitHandler(app, server);
}
