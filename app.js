var http = require('http');
var path = require('path');
var piler = require('piler');
var reload = require('reload');
var express = require('express');

var routes = require('./server/routes');
var api = require('./server/routes/api');

var app = module.exports = express();
var pwd = __dirname;

var clientjs = piler.createJSManager({
	outputDirectory: __dirname + "/gen/js",
	urlRoot: "/js/"
});
var clientcss = piler.createCSSManager({
	outputDirectory: __dirname + "/gen/css",
	urlRoot: "/css/"
});

/**
 * Configuration
 */

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(pwd, 'client', 'views'));
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(__dirname + '/client/static'));
app.use(express.static(__dirname + '/data/assets'));
app.use(express.compress());
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

var index = function(req, res){
	res.render('index', {
		layout: false,
		js: clientjs.renderTags(),
		css: clientcss.renderTags()
	});
};

app.get('/', index);
app.get('/tables', index);
app.get('/table', index);
app.get('/table/*', index);

// serve index and view partials
app.get('/partials/:name', routes.partials);
app.get('/partials/modals/:name', routes.modals);

// JSON API
app.get('/api/table/:id', api.table);
app.get('/api/tables', api.tables);


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
	clientjs.addFile(__dirname + "/client/code/controller/tables.js");
	clientjs.addFile(__dirname + "/client/code/controller/table.js");
	clientjs.addFile(__dirname + "/client/code/service/timeago.js");
	clientjs.addFile(__dirname + "/client/code/directive/timeago.js");
	clientjs.addFile(__dirname + "/client/code/directive/elastic.js");
});

reload(server, app);
server.listen(app.get('port'), function() {
	console.log('Express server listening on port ' + app.get('port'));
});
