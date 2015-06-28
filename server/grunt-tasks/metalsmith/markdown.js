
/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

var basename = require('path').basename;
var debug = require('debug')('metalsmith-markdown');
var dirname = require('path').dirname;
var extname = require('path').extname;
var md = require('../../modules/md');

/**
 * Metalsmith plugin to convert markdown files.
 *
 * @param {Object} options (optional)
 * @return {Function}
 */
module.exports = function(preset, options){

	return function(files, metalsmith, done){
		setImmediate(done);
		Object.keys(files).forEach(function(file){
			debug('checking file: %s', file);
			if (!is_markdown(file)) {
				return;
			}
			var data = files[file];
			var dir = dirname(file);
			var html = basename(file, extname(file)) + '.html';
			if ('.' != dir) html = dir + '/' + html;

			debug('converting file: %s', file);
			var str = md.render(data.contents.toString());
			data.contents = new Buffer(str);

			delete files[file];
			files[html] = data;
		});
	};
};

/**
 * Check if a `file` is markdown.
 *
 * @param {String} file
 * @return {Boolean}
 */

function is_markdown(file){
	return /\.md|\.markdown/.test(extname(file));
}
