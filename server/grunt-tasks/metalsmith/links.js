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

"use strict";

module.exports = function(opts) {

	opts = opts || {};
	opts.absolute = opts.absolute !== false;
	opts.noext = opts.noext === true;

	return function (files, metalsmith, done) {
		for (var filepath in files) {
			if (files.hasOwnProperty(filepath)) {
				var link = (opts.absolute ? '/' : '') + filepath.replace(/\\/g, '/');
				if (opts.permalinks) {
					link = link.replace(/\/[^\/]+$/, '');
				}
				if (opts.noext) {
					link = link.replace(/\.[^\.]+$/, '');
				}
				if (link.substr(link.lastIndexOf('/')) === '/index') {
					link = link.substr(0, link.lastIndexOf('/'));
				}
				files[filepath].link = link;
			}
		}
		done();
	};
};
