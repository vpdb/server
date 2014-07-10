var path = require('path');
var http = require('http');
var flash = require('connect-flash');
var logger = require('winston');
var express = require('express');
var expressWinston = require('express-winston');

var domainError = require('express-domain-errors');
var gracefulExit = require('express-graceful-exit');

var writeable = require('./modules/writeable');
var asset = require('./middleware/asset');
var ctrl = require('./controllers/ctrl');
var webCtrl = require('./controllers/web');
var apiCtrl = require('./controllers/api/api');

module.exports = function(app, config, passport) {

	var runningLocal = !process.env.APP_NAME || (process.env.APP_NAME != 'production' && process.env.APP_NAME != 'staging');
	var runningDev = process.env.NODE_ENV != 'production';

	logger.info('[express] Setting up Express for running %s in %s mode.', runningLocal ? 'locally' : 'remotely', runningDev ? 'development' : 'production');

	app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
	app.set('ipaddress', process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
	app.set('views', path.resolve(__dirname, '../client/views'));
	app.set('view engine', 'jade');
	app.set('json spaces', "\t");
	app.set('showStackError', runningDev);

	// add reverse proxy config for non-local
	if (!runningLocal) {
		app.enable('trust proxy');
	}

	app.use(domainError(sendOfflineMsg, doGracefulExit));

	// log to file if env APP_ACCESS_LOG is set
	if (process.env.APP_ACCESS_LOG) {
		app.use(expressWinston.logger({
			transports: [
				new logger.transports.File({
					level: 'info',                   // Level of messages that this transport should log.
					silent: false,                   // Boolean flag indicating whether to suppress output.
					colorize: false,                 // Boolean flag indicating if we should colorize output.
					timestamp: true,                 // Boolean flag indicating if we should prepend output with timestamps (default true). If function is specified, its return value will be used instead of timestamps.
					filename: process.env.APP_ACCESS_LOG,  // The filename of the logfile to write output to.
					maxsize: 1000000,                // Max size in bytes of the logfile, if the size is exceeded then a new file is created.
					maxFiles: 10,                    // Limit the number of files created when the size of the logfile is exceeded.
					stream: null,                    // The WriteableStream to write output to.
					json: false                      // If true, messages will be logged as JSON (default true).
				})
			],
			meta: false, // optional: control whether you want to log the meta data about the request (default to true)
			msg: '[http] {{req.ip}}: {{req.method}} {{req.url}} - {{res.statusCode}} {{res.responseTime}}ms' // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
		}));
		logger.info('[express] Access log will be written to %s.', process.env.APP_ACCESS_LOG);
	} else {
		app.use(express.logger('dev'));
	}

	if (runningLocal) {
		// in production the reverse proxy is taking care of this
		app.use(express.compress({ filter: function(req, res) { return /json|text|javascript|css/.test(res.getHeader('Content-Type')); }, level: 9 }));
	}

	// general stuff
	app.use(express.cookieParser());   // cookieParser should be above session
	app.use(express.json());           // bodyParser should be above methodOverride
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(express.favicon(path.resolve(__dirname, '../client/static/images/favicon.png')));

	// static file serving
	app.use(express.static(writeable.cacheRoot, { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../client/static'), { maxAge: 3600*24*30*1000 }));
	app.use('/js', express.static(path.resolve(__dirname, '../client/code'), { maxAge: 3600*24*30*1000 }));
	app.use(express.static(path.resolve(__dirname, '../data/assets'), { maxAge: 3600*24*30*1000 }));
	app.use(asset.middleware());

	// use passport session
	app.use(passport.initialize());

	// connect flash for flash messages
	app.use(flash());

	// api pre-checks
//	app.use(apiCtrl.checkApiContentType);


	app.use('/styleguide', express.static(path.resolve(__dirname, '../styleguide')));


	// routes should be at the last (pretty much)
	app.use(app.router);

	// api errors
	app.use(apiCtrl.handleParseError);

	// error logger comes at the very last
	app.use(expressWinston.errorLogger({
		transports: [
			new logger.transports.Console({ json: false, colorize: true })
		]
	}));

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
		logger.error('[express] %s', err.stack);

		// error page
		ctrl.renderError(500, 'Internal Server Error.')(req, res);
	});

	// assume 404 since no middleware responded
	app.use(ctrl.renderError(404, 'Not found.'));
};

function sendOfflineMsg() {
	if (process.send) {
		process.send('offline');
	}
}
function doGracefulExit(err) {
	gracefulExit.gracefulExitHandler(app, server);
}
