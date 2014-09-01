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

var _ = require('lodash');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var logger = require('winston');
var wiredep = require('wiredep');

var writeable = require('./writeable');

function Assets() {

	var that = this;
	var jsRoot = path.resolve(__dirname, '../../client/code');
	var cssRoot = writeable.cssRoot;

	this.app = { js: [], css: [] };
	this.deps = { js: [], css: [], fonts: [], 'public': [] };

	// application javascripts
	_.each([ 'app.js', 'controllers.js', 'directives.js', 'filters.js', 'services.js', '/*/**.js' ], function(ptrn) {
		_.each(glob.sync(jsRoot + '/' + ptrn), function(file) {
			that.app.js.push({
				src: path.resolve(file),
				web: '/js' + file.substr(jsRoot.length)
			});
		});
	});

	// application css (only one file)
	this.app.css.push({
		src: path.resolve(cssRoot, 'vpdb.css'),
		web: '/css/vpdb.css?'
	});

	// vendor libs from bower
	var dep, bowerDir = path.resolve(__dirname, '../../bower_components');
	if (fs.existsSync(bowerDir)) {
		dep = wiredep({
			cwd: path.resolve(__dirname, '../../'),
			directory: bowerDir,
			bowerJson: require(path.resolve(__dirname, '../../bower.json'))
		});
	}
	if (!dep || !dep.packages) { // don't bother if bower deps weren't installed yet
		return logger.warn('[assets] No Bower directory found or wiredep came up empty (%s)', dep);
	}
	var n = 0;
	_.each(dep.packages, function(pak, name) {
		_.each(pak.main, function(file) {
			_.each(glob.sync(file), function(file) {
				var ext = path.extname(file.toLowerCase());
				var key, suffix = '', prefix = '', shift = 0;
				if (ext === '.js') {
					key = 'js';
					suffix = '/' + name;
					prefix = 'lib/';
				} else if (ext === '.css') {
					key = 'css';
				} else if (_.contains(['.woff', '.ttf', '.svg', '.eot', '.otf'], ext)) {
					key = 'fonts';
				} else {
					key = 'public';
				}
				var web = prefix + key + suffix + '/' + path.basename(file);
				/* manual override sort:
				 *   - put all jquery stuff before angular (https://github.com/angular/angular.js/issues/8471)
				 *   - put html5-shim before angular
				 */
				if (/\/jquery(\-ui)?\//i.test(web)) {
					shift = -100;
				}
				if (/\-shim/i.test(web)) {
					shift = -50;
				}
				var f = {
					src: path.resolve(file),
					dest: path.resolve(writeable.buildRoot, web),
					web: '/' + web,
					index: shift + n++
				};
				that.deps[key].push(f);
			});
		});
	});
	//logger.info('[assets] Found %d CSS, %d JavaScripts, %d fonts and %d other Bower dependencies.', this.deps.css.length, this.deps.js.length, this.deps.fonts.length, this.deps.public.length);

	// now re-sort by index
	this.deps.js.sort(function(a, b) {
		return a.index - b.index;
	});
}

Assets.prototype.vendor = function() {
	return this.deps.js.concat(this.deps.css).concat(this.deps.fonts).concat(this.deps.public);
};

Assets.prototype.getCss = function() {
	return this.deps.css.concat(this.app.css);
};

Assets.prototype.getJs = function() {
	return this.deps.js.concat(this.app.js);
};

module.exports = new Assets();