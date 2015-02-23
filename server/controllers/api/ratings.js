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
var util = require('util');
var async = require('async');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var Rating = require('mongoose').model('Rating');
var api = require('./api');

var error = require('../../modules/error')('api', 'rating');

exports.createForGame = function(req, res) {

	var assert = api.assert(error, 'create', req.user.email, res);

	game(req, res, assert, function(game, duplicateRating) {

		if (duplicateRating) {
			return api.fail(res, error('Cannot vote twice. Use PUT in order to update a vote.').warn('create'), 400);
		}

		var rating = new Rating({
			_from: req.user,
			_ref: { game: game },
			value: req.body.value,
			created_at: new Date()
		});

		rating.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}

			rating.save(assert(function(rating) {

				Rating.find({ '_ref.game': game }, assert(function(ratings) {

					logger.info('[api|rating:create] User <%s> rated game "%s" %d.', req.user.email, game.id, rating.value);

					// calculate average rating
					var avg = _.reduce(_.pluck(ratings, 'value'), function (sum, value) {
							return sum + value;
						}, 0) / ratings.length;

					var summary = { average: Math.round(avg * 1000) / 1000, votes: ratings.length };
					game.update({ rating: summary }, assert(function () {

						return api.success(res, { value: rating.value, game: summary }, 201);
					}));

				}, 'Error fetching existent ratings.'));
			}, 'Error saving rating.'));
		});
	});
};

exports.getForGame = function(req, res) {
	var assert = api.assert(error, 'get', req.user.email, res);
	game(req, res, assert, function(game, rating) {
		if (rating) {
			api.success(res, _.pick(rating, ['value', 'created_at']));
		} else {
			api.fail(res, error('No rating of <%s> for "%s" found.', req.user.email, game.title), 404);
		}
	});
};

function game(req, res, assert, callback) {
	Game.findOne({ id: req.params.id }, assert(function(game) {
		if (!game) {
			return api.fail(res, error('No such game with ID "%s"', req.params.id), 404);
		}
		Rating.findOne({ _from: req.user, '_ref.game': game }, assert(function(duplicateRating) {
			callback(game, duplicateRating);

		}, 'Error searching for current rating.'));
	}, 'Error finding game in order to get comment from <%s>.'));
}