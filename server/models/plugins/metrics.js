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

module.exports = function(schema, options) {

	options = options || {};

	schema.methods.incrementCounter = function(what, next) {
		next = next || function() {};
		var that = this;
		var q = { $inc: { } };
		q.$inc['counter.' + what] = 1;

		if (options.hotness) {
			q.metrics = q.metrics || {};
			_.each(options.hotness, function(hotness, metric) {
				var score = 0;
				_.each(hotness, function(factor, variable) {
					score += factor * that.counter[variable];
				});
				q.metrics[metric] = Math.log(Math.max(score, 1));
			});
		}
		this.update(q, next);
	};
};