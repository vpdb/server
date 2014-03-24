var nib = require('nib');
var http = require('http');
var path = require('path');
var stylus = require('stylus');
var reload = require('reload');
var express = require('express');

var routes = require('./server/routes');
var api = require('./server/routes/api');

var app = module.exports = express();
var pwd = __dirname;

// enable nib
function compile(str, path) {
	return stylus(str)
		.set('filename', path)
		.set('compress', true)
		.use(nib())
		.import('nib');
}

/**
 * Configuration
 */
// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(pwd, 'client', 'views'));
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(stylus.middleware({
	src: path.join(pwd, 'client', 'css'), //__dirname + '/client/css',
	dest: path.join(pwd, 'client', 'static', 'css'),
	compile: compile,
	debug: true,
	force: true
}));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(__dirname + '/client/code'));
app.use(express.static(__dirname + '/client/static'));
app.use(express.static(__dirname + '/client/static/css'));
app.use(express.static(__dirname + '/data/assets'));
app.use(app.router);

// development only
if (app.get('env') === 'development') {
	app.use(express.errorHandler());
	app.configure('development', function(){
		app.use(express.errorHandler());
		app.locals.pretty = true;
	});
}

// production only
if (app.get('env') === 'production') {
	// TODO
}


/**
 * Routes
 */

// serve index and view partials
app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

// JSON API
app.get('/api/table/:id', api.table);
app.get('/api/tables', api.tables);

// redirect all others to the index (HTML5 history)
app.get('*', routes.index);


/**
 * Start Server
 */
var server = http.createServer(app);
reload(server, app);
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});
