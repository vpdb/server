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

var _ = require('lodash');
var jade = require('jade');

module.exports = function(opts) {

	opts = opts || {};

	var options = opts.options || {};

	return function(files, metalsmith, done) {
		var data;
		try {

			if (!opts.name) {
				return done('Need a name.');
			}
			if (!opts.src) {
				return done('Need a source template.');
			}
			if (!opts.dest) {
				return done('Need a destination path.');
			}

			var metadata = metalsmith.metadata();
			var sectionIndex;

			for (var i = 0; i < metadata[opts.name].length; i++) {
				sectionIndex = metadata[opts.name][i];
				data =  _.extend(
					_.pick(metadata, 'subsections'),
					_.pick(sectionIndex, 'section'),
					options,
					{ inspect: require('util').inspect }
				);

				if (metadata.api[sectionIndex.section]) {
					data.api = metadata.api[sectionIndex.section];

				}
				var html = jade.renderFile(opts.src, data);
				files[sectionIndex.section + '/' + opts.dest] = { contents: new Buffer(html) };
			}
			done();
		} catch (e) {
			done(e);
		}
	};
};
