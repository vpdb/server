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

"use strict";

var _ = require('lodash');
var asset = require('../modules/asset');

/* istanbul ignore next */
exports.middleware = function() {

	var sizes = {
		square: { small: 150, medium: 300 }
	};

	return function(req, res, next) {
		// example: /asset/release/954/square-small.png
		var m = req.originalUrl.match(/^\/asset\/([^\/]+)\/([^\/]+)\/([^\-]+)(-[^\-]+)?\.png$/i);
		if (m) {
			var type = m[1];
			var key = m[2];
			var format = m[3];
			var size = m[4] ? m[4].substr(1) : null;

			if (_.contains(['square'], format)) {
				var s = size && sizes[format][size] ? sizes[format][size] : null;
				asset[format].call(asset, { res: res, req: req }, type, key, s);
			} else {
				//console.log(require('util').inspect(res, false, 100, true));
				res.writeHead(404, 'Not found. "' + format + '" is not a known image type.');
				res.end();
			}
		} else {
			next();
		}
	};
};