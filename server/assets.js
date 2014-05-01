var fs = require('fs');
var path = require('path');
var piler = require('piler');

// hack for weird context calls. we're a singleton anyways.
var instance;

function Assets(app, server) {

	this.app = app;
	this.server = server;

	// check cache dir
	var cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.normalize(__dirname + "/../gen");
	if (!fs.existsSync(cacheRoot)) {
		throw 'Cannot find cache dir "' + cacheRoot + '" for generating assets.';
	}
	// setup cache dir
	var cacheJs = cacheRoot + '/js';
	var cacheCss = cacheRoot + '/css';
	if (!fs.existsSync(cacheJs)) {
		fs.mkdirSync(cacheJs);
	}
	if (!fs.existsSync(cacheCss)) {
		fs.mkdirSync(cacheCss);
	}

	this.clientjs = piler.createJSManager({
		outputDirectory: cacheJs,
		urlRoot: "/js/"
	});
	this.clientcss = piler.createCSSManager({
		outputDirectory: cacheCss,
		urlRoot: "/css/"
	});
	instance = this;
}

Assets.prototype.renderJsTags = function() {
	return instance.clientjs.renderTags();
};

Assets.prototype.renderCssTags = function() {
	return instance.clientcss.renderTags();
};

Assets.prototype.liveUpdate = function() {
	var that = instance;
	that.clientjs.liveUpdate(that.clientcss);
};

Assets.prototype.renderIndex = function(req, res) {
	var that = instance;
	res.render('index', {
		layout: false,
		js: that.renderJsTags(),
		css: that.renderCssTags()
	});
};

Assets.prototype.configure = function() {

	var that = instance;
	var clientDir = __dirname + "/../client";

	that.clientjs.bind(that.app, that.server);
	that.clientcss.bind(that.app, that.server);

	that.clientcss.addFile(clientDir + "/static/css/lib/bootstrap-3.1.1.css");
	that.clientcss.addFile(clientDir + "/static/css/lib/font-awesome.css");
	that.clientcss.addFile(clientDir + "/static/css/lib/magnific-popup.css");
	that.clientcss.addFile(clientDir + "/static/css/lib/nanoscroller.css");
	that.clientcss.addFile(clientDir + "/static/css/fonts.css");
	that.clientcss.addFile(clientDir + "/css/app.styl");
	that.clientcss.addFile(clientDir + "/css/colors.styl");
	that.clientcss.addFile(clientDir + "/css/animations.styl");

	that.clientjs.addFile(clientDir + "/code/lib/jquery-2.1.0.js");
	that.clientjs.addFile(clientDir + "/code/lib/angular-1.3.0-beta.3/angular.js");
	that.clientjs.addFile(clientDir + "/code/lib/angular-1.3.0-beta.3/angular-route.js");
	that.clientjs.addFile(clientDir + "/code/lib/angular-1.3.0-beta.3/angular-animate.js");
	that.clientjs.addFile(clientDir + "/code/lib/angular-1.3.0-beta.3/angular-sanitize.js");
	that.clientjs.addFile(clientDir + "/code/lib/angulartics-0.14.15/angulartics.js");
	that.clientjs.addFile(clientDir + "/code/lib/angulartics-0.14.15/angulartics-ga.js");
	that.clientjs.addFile(clientDir + "/code/lib/angulartics-0.14.15/angulartics-ga-cordova.js");
	that.clientjs.addFile(clientDir + "/code/lib/ui-bootstrap-tpls-0.10.0.js");
	that.clientjs.addFile(clientDir + "/code/lib/underscore-1.6.0.js");
	that.clientjs.addFile(clientDir + "/code/lib/showdown.js");
	that.clientjs.addFile(clientDir + "/code/lib/jquery.magnific-popup-0.9.9.js");
	that.clientjs.addFile(clientDir + "/code/lib/jquery.nanoscroller-0.8.0.js");
	that.clientjs.addFile(clientDir + "/code/lib/jquery.waitforimages-1.5.0.js");
	that.clientjs.addFile(clientDir + "/code/lib/angular.scrollable-0.2.0.js");
	that.clientjs.addFile(clientDir + "/code/app.js");
	that.clientjs.addFile(clientDir + "/code/services.js");
	that.clientjs.addFile(clientDir + "/code/controllers.js");
	that.clientjs.addFile(clientDir + "/code/filters.js");
	that.clientjs.addFile(clientDir + "/code/directives.js");
	that.clientjs.addFile(clientDir + "/code/controller/home.js");
	that.clientjs.addFile(clientDir + "/code/controller/games.js");
	that.clientjs.addFile(clientDir + "/code/controller/game.js");
	that.clientjs.addFile(clientDir + "/code/service/timeago.js");
	that.clientjs.addFile(clientDir + "/code/directive/timeago.js");
	that.clientjs.addFile(clientDir + "/code/directive/elastic.js");
};

module.exports = Assets;