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

var debug = require('debug')('metalsmith-apilinks');

module.exports = function(opts) {

	opts = opts || {};

	return function (files, metalsmith, done) {
		var contents, changed;
		for (var filepath in files) {
			if (files.hasOwnProperty(filepath)) {
				if (filepath.substr(filepath.length - 5, filepath.length) === '.html') {
					contents = files[filepath].contents.toString();
					changed = false;
					//noinspection JSHint
					contents = contents.replace(/\s+href="api:\/\/([^\/]+)[^"]+"/gi, function(match) {
						var apiName, apiPath, link, method, resource;
						match = match.match(/api:\/\/([^\/]+)\/([^"]*)"/i);
						apiName = match[1];
						apiPath = match[2].split('/');
						if (apiName && apiPath.length && opts[apiName]) {
							link = opts[apiName].path;

							if (apiPath.length > 1) {
								method = apiPath.splice(0, 1)[0];
							} else {
								method = null;
							}
							resource = apiPath[0];

							apiPath.pop();

							link += '/' + resource;
							if (method) {
								link += '#' + method + (apiPath.length ? '.' + apiPath.join('.') : '');
							}

							changed = true;
							debug('Rewriting link %s to %s', match[0], link);
							return ' href="' + link + '"';
						} else {
							return match;
						}
					});
					if (changed) {
						files[filepath].contents = new Buffer(contents);
					}
				}
			}
		}
		done();
	};
};
