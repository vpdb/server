var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var writeable = require('../modules/writeable');

function Assets() {
	var jsRoot = path.resolve(__dirname, '../../client/code');
	var cssRoot = path.resolve(__dirname, '../../client/static/css');
	var cacheRoot = writeable.cacheRoot;
	var cssCacheRoot = path.resolve(cacheRoot, 'css/');

	var assets = {
		js: [
			'lib/jquery-2.1.0.js',
			'lib/angular-1.3.0-beta.3/angular.js',
			'lib/angular-1.3.0-beta.3/angular-route.js',
			'lib/angular-1.3.0-beta.3/angular-animate.js',
			'lib/angular-1.3.0-beta.3/angular-sanitize.js',
			'lib/angulartics-0.14.15/angulartics.js',
			'lib/angulartics-0.14.15/angulartics-ga.js',
			'lib/angulartics-0.14.15/angulartics-ga-cordova.js',
			'lib/ui-bootstrap-tpls-0.10.0.js',
			'lib/underscore-1.6.0.js',
			'lib/showdown.js',
			'lib/jquery.magnific-popup-0.9.9.js',
			'lib/jquery.nanoscroller-0.8.0.js',
			'lib/jquery.waitforimages-1.5.0.js',
			'lib/angular.scrollable-0.2.0.js',
			'app.js',
			'services.js',
			'controllers.js',
			'filters.js',
			'directives.js'
		],
		css: [ 'fonts.css' ],
		cssCache: []
	};
	// javascript files
	_.each(['controller', 'service', 'directive'], function(dir) {
		fs.readdirSync(jsRoot + '/' + dir).forEach(function(file) {
			assets.js.push(dir + '/' + file);
		});
	});

	// vanilla css files
	fs.readdirSync(cssRoot + '/lib').forEach(function(file) {
		assets.css.push('lib/' + file);
	});
	// compiled from stylus
	if (fs.existsSync(cssCacheRoot)) {
		fs.readdirSync(cssCacheRoot).forEach(function(file) {
			if (!/\.min\./.test(file)) { // "elegant" way to ignore global.min.css, which already contains everything.
				assets.cssCache.push(file);
			}
		});
	}

	this.assets = assets;
}

var assets = new Assets();
module.exports = assets.assets;