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
	this.cacheRoot = process.env.APP_CACHEDIR ? process.env.APP_CACHEDIR : path.resolve(__dirname, "../../cache");

	this.jsRoot = path.resolve(this.cacheRoot, 'js');
	this.cssRoot = path.resolve(this.cacheRoot, 'css');
	this.imgRoot = path.resolve(this.cacheRoot, 'img');
	this.htmlRoot = path.resolve(this.cacheRoot, 'html');
	this.fontsRoot = path.resolve(this.cacheRoot, 'fonts');

	/* istanbul ignore if */
	if (!fs.existsSync(this.jsRoot)) {
		fs.mkdirSync(this.jsRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.cssRoot)) {
		fs.mkdirSync(this.cssRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.imgRoot)) {
		fs.mkdirSync(this.imgRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.htmlRoot)) {
		fs.mkdirSync(this.htmlRoot);
	}
	/* istanbul ignore if */
	if (!fs.existsSync(this.fontsRoot)) {
		fs.mkdirSync(this.fontsRoot);
	}
}

var writeable = new Writeable();
exports.cacheRoot = writeable.cacheRoot;