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
var logger = require('winston');

var Rating = require('mongoose').model('Rating');

function Metrics() {

	this.entities = {
		game: require('mongoose').model('Game'),
		release: require('mongoose').model('Release')
	};

}


Metrics.prototype.updateRatedEntity = function(ref, entity, rating, user, callback) {

	var q = {};
	q['_ref.' + ref] = entity;
	Rating.find(q, function(err, ratings) {

		/* istanbul ignore if */
		if (err) {
			return callback(err);
		}

		logger.info('[api|rating] User <%s> rated %s "%s" %d.', user.email, ref, entity.id, rating.value);

		// calculate average rating
		var avg = _.reduce(_.pluck(ratings, 'value'), function (sum, value) {
			return sum + value;
		}, 0) / ratings.length;

		var summary = { average: Math.round(avg * 1000) / 1000, votes: ratings.length };
		entity.update({ rating: summary }, function(err) {

			/* istanbul ignore if */
			if (err) {
				return callback(err);
			}

			var result = { value: rating.value, created_at: rating.created_at };
			result[ref] = summary;

			callback(null, result);
		});
	});
};


module.exports = new Metrics();