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

const fs = require('fs');
const path = require('path');

function Writeable() {

	this.buildRoot = process.env.APP_BUILDDIR ? process.env.APP_BUILDDIR : path.resolve(__dirname, '../../build');
	this.devsiteRoot = process.env.APP_BUILDDIR ? process.env.APP_DEVSITEDIR : path.resolve(__dirname, '../../devsite');

	this.jsRoot = path.resolve(this.buildRoot, 'js');
	this.cssRoot = path.resolve(this.buildRoot, 'css');
	this.htmlRoot = path.resolve(this.buildRoot, 'html');
	this.fontsRoot = path.resolve(this.buildRoot, 'fonts');

	/* istanbul ignore if */
	if (!fs.existsSync(this.buildRoot)) {
		fs.mkdirSync(this.buildRoot);
	}
	if (!fs.existsSync(this.devsiteRoot)) {
		fs.mkdirSync(this.devsiteRoot);
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
}

const writeable = new Writeable();
exports.buildRoot = writeable.buildRoot;
exports.devsiteRoot = writeable.devsiteRoot;
exports.jsRoot = writeable.jsRoot;
exports.cssRoot = writeable.cssRoot;
exports.htmlRoot = writeable.htmlRoot;
exports.fontsRoot = writeable.fontsRoot;
