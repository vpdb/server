/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict";

var _ = require('underscore');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var async = require('async');
var wiredep = require('wiredep');

var writeable = require('../modules/writeable');

function Assets() {

	var jsRoot = path.resolve(__dirname, '../../client/code');
	var cssRoot = path.resolve(__dirname, '../../client/static/css');
	var cacheRoot = writeable.cacheRoot;
	var cssCacheRoot = path.resolve(cacheRoot, 'css/');

	var assets = {
		js: [
			'lib/jquery-2.1.0.js',
			'lib/jquery-ui-custom-1.11.0.js',
			'lib/angular-file-upload-shim-1.4.0.js',
			'lib/angular-1.3.0-beta.8/angular.js',
			'lib/angular-1.3.0-beta.8/angular-route.js',
			'lib/angular-1.3.0-beta.8/angular-animate.js',
			'lib/angular-1.3.0-beta.8/angular-sanitize.js',
			'lib/angular-1.3.0-beta.8/angular-resource.js',
			'lib/angular-file-upload-1.4.0.js',
			'lib/angular-dragdrop-1.0.7.js',
			'lib/angulartics-0.14.15/angulartics.js',
			'lib/angulartics-0.14.15/angulartics-ga.js',
			'lib/angulartics-0.14.15/angulartics-ga-cordova.js',
			'lib/ui-bootstrap-tpls-0.11.0.js',
			'lib/underscore-1.6.0.js',
			'lib/showdown.js',
			'lib/jquery.magnific-popup-0.9.9.js',
			'lib/jquery.nanoscroller-0.8.0.js',
			'lib/jquery.waitforimages-1.5.0.js',
			'lib/jquery.throttle-debounce-1.1.js',
			'lib/angular.scrollable-0.2.0.js',
			'lib/angular.storage-bea0498.js',
			'app.js',
			'services.js',
			'controllers.js',
			'filters.js',
			'directives.js'
		],
		css: [ 'fonts.css', 'hljs-pojoaque.css' ],
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
			// "elegant" way to ignore global.min.css, which already contains everything.
			if (!/\.min\./.test(file) && !/color-def/.test(file)) {
				assets.cssCache.push(file);
			}
		});
	}

	assets.getJS = function() {
		return _.map(assets.js, function(js) {
			return '/js/' + js;
		});
	};

	assets.getCSS = function() {
		return _.map(_.union(assets.css, assets.cssCache), function(css) {
			return '/css/' + css;
		});
	};

	assets.testBower = function() {

		var dep = wiredep();

		var deps = {
			js: [],
			css: [],
			fonts: [],
			other: []
		};

		async.eachSeries(_.keys(dep.packages), function(name, next) {
			async.eachSeries(dep.packages[name].main, function(file, next) {
				glob(file, {}, function (er, files) {
					_.each(files, function(file) {

						var ext = path.extname(file.toLowerCase());

						var key;
						if (ext === '.js') {
							key = 'js';
						} else if (ext === '.css') {
							key = 'css';
						} else if (_.contains(['.woff', '.ttf', '.svg', '.eot', '.otf'], ext)) {
							key = 'fonts';
						} else {
							key = 'other';
						}
						var web = key + '/lib/' + name + '/' + path.basename(file);
						var f = {
							src: path.resolve(file),
							dest: path.resolve(writeable.cacheRoot, web),
							web: '/' + web
						};
						deps[key].push(f);
					});
					next();
				});
			}, next);
		}, function(err) {
			console.log(require('util').inspect(deps, null, 4, true));
		});



	};

	this.assets = assets;
}

var assets = new Assets();
module.exports = assets.assets;