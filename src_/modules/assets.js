/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const _ = require('lodash');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const logger = require('winston');
const wiredep = require('wiredep');

const settings = require('../../src/common/settings');
const writeable = require('./writeable');

function Assets() {

	const that = this;
	const jsRoot = path.resolve(__dirname, '../../client/app');
	const cssRoot = writeable.cssRoot;

	this.app = { js: [], css: [] };
	this.deps = { js: [], css: [], fonts: [], 'public': [] };

	// client config
	this.app.js.push({
		src: path.resolve(writeable.jsRoot, settings.clientConfigName()),
		web: '/js/config.js'
	});

	// application javascripts
	[ 'app.js', '/*/**.js' ].forEach(function(ptrn) {
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
		web: '/css/vpdb.css'
	});

	// vendor libs from bower
	let dep;
	const bowerDir = path.resolve(__dirname, '../../bower_components');
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
	let n = 0;
	_.each(dep.packages, function(pak, name) {
		_.each(pak.main, function(file) {
			_.each(glob.sync(file), function(file) {
				const ext = path.extname(file.toLowerCase());
				let key, suffix = '', prefix = '', shift = 0;
				if (ext === '.js') {
					key = 'js';
					suffix = '/' + name;
					prefix = 'lib/';
				} else if (ext === '.css') {
					key = 'css';
				} else if (_.includes(['.woff', '.woff2', '.ttf', '.svg', '.eot', '.otf'], ext)) {
					key = 'fonts';
				} else {
					key = 'public';
				}
				const web = prefix + key + suffix + '/' + path.basename(file);
				/* manual override sort:
				 *   - put all jquery stuff before angular (https://github.com/angular/angular.js/issues/8471)
				 *   - put html5-shim before angular
				 */
				if (/\/jquery(-ui)?\//i.test(web)) {
					shift = -100;
				}
				if (/-shim/i.test(web)) {
					shift = -50;
				}
				const f = {
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