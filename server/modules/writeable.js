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

var fs = require('fs');
var path = require('path');

function Writeable() {

	this.buildRoot = process.env.APP_BUILDDIR ? process.env.APP_BUILDDIR : path.resolve(__dirname, "../../build");
	this.cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.resolve(__dirname, "../../cache");

	this.imgCache = path.resolve(this.cacheRoot, 'img');

	this.jsRoot = path.resolve(this.buildRoot, 'js');
	this.cssRoot = path.resolve(this.buildRoot, 'css');
	this.htmlRoot = path.resolve(this.buildRoot, 'html');
	this.fontsRoot = path.resolve(this.buildRoot, 'fonts');

	/* istanbul ignore if */
	if (!fs.existsSync(this.buildRoot)) {
		fs.mkdirSync(this.buildRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.jsRoot)) {
		fs.mkdirSync(this.jsRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.cssRoot)) {
		fs.mkdirSync(this.cssRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.htmlRoot)) {
		fs.mkdirSync(this.htmlRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.fontsRoot)) {
		fs.mkdirSync(this.fontsRoot);
	}

	/* istanbul ignore if */
	if (!fs.existsSync(this.imgCache)) {
		fs.mkdirSync(this.imgCache);
	}
}

var writeable = new Writeable();
exports.cacheRoot = writeable.cacheRoot;
exports.buildRoot = writeable.buildRoot;
exports.jsRoot = writeable.jsRoot;
exports.cssRoot = writeable.cssRoot;
exports.htmlRoot = writeable.htmlRoot;
exports.fontsRoot = writeable.fontsRoot;

exports.imgCache = writeable.imgCache;
