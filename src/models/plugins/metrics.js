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

module.exports = function(schema, options) {

	options = options || {};

	/**
	 * Increments a counter.
	 *
	 * @param {string} what Property to increment
	 * @param {boolean} [decrement] If set to true, decrement instead counter instead of increment.
	 * @param {function} [next]
	 * @returns {Promise}
	 */
	schema.methods.incrementCounter = function(what, decrement, next) {
		if (_.isFunction(decrement)) {
			next = decrement;
			decrement = false;
		}
		next = next || function() {};
		var incr = decrement ? -1 : 1;
		var that = this;
		var q = { $inc: { } };
		q.$inc['counter.' + what] = incr;

		if (options.hotness) {
			q.metrics = q.metrics || {};
			_.each(options.hotness, function(hotness, metric) {
				var score = 0;
				_.each(hotness, function(factor, variable) {
					if (that.counter[variable]) {
						score += factor * (that.counter[variable] + (variable === what ? incr : 0));
					}
				});
				q.metrics[metric] = Math.log(Math.max(score, 1));
			});
		}
		return this.update(q).exec().nodeify(next);
	};
};