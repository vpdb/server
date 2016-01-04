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
var logger = require('winston');

var Game = require('mongoose').model('Game');
var Release = require('mongoose').model('Release');
var Rating = require('mongoose').model('Rating');
var LogEvent = require('mongoose').model('LogEvent');
var api = require('./api');
var metrics = require('../../modules/metrics');

var error = require('../../modules/error')('api', 'rating');

exports.createForGame = function(req, res) {
	create(req, res, 'game', find(Game, 'game'));
};

exports.getForGame = function(req, res) {
	view(req, res, find(Game, 'game'), 'title');
};

exports.updateForGame = function(req, res) {
	update(req, res, 'game', find(Game, 'game'), 'title');
};

exports.createForRelease = function(req, res) {
	create(req, res, 'release', find(Release, 'release', '_game'));
};

exports.getForRelease = function(req, res) {
	view(req, res, find(Release, 'release'), 'name');
};

exports.updateForRelease = function(req, res) {
	update(req, res, 'release', find(Release, 'release', '_game'), 'name');
};

/**
 * Generic function for viewing a rating.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {function} find Function that returns entity and rating.
 * @param {string} titleAttr Attribute of the entity that contains a title
 */
function view(req, res, find, titleAttr) {

	var assert = api.assert(error, 'view', req.user.email, res);
	find(req, res, assert, function(entity, rating) {

		if (rating) {
			api.success(res, _.pick(rating, ['value', 'created_at', 'modified_at' ]));
		} else {
			api.fail(res, error('No rating of <%s> for "%s" found.', req.user.email, entity[titleAttr]), 404);
		}
	});
}

/**
 * Generic function for creating a rating.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {string} ref Reference name
 * @param {function} find Function that returns entity and rating.
 */
function create(req, res, ref, find) {

	var assert = api.assert(error, 'create', req.user.email, res);
	find(req, res, assert, function(entity, duplicateRating) {
		if (duplicateRating) {
			return api.fail(res, error('Cannot vote twice. Use PUT in order to update a vote.').warn('create'), 400);
		}
		var obj = {
			_from: req.user._id,
			_ref: {},
			value: req.body.value,
			created_at: new Date()
		};
		obj._ref[ref] = entity._id;
		var rating = new Rating(obj);

		rating.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}
			rating.save(assert(function(rating) {

				updateRatedEntity(req, res, ref, assert, entity, rating, 201);
			}, 'Error saving rating.'));
		});
	});
}

/**
 * Generic function for updating a rating.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {string} ref Reference name
 * @param {function} find Function that returns entity and rating.
 * @param {string} titleAttr Attribute of the entity that contains a title
 */
function update(req, res, ref, find, titleAttr) {

	var assert = api.assert(error, 'update', req.user.email, res);
	find(req, res, assert, function(entity, rating) {
		if (!rating) {
			return api.fail(res, error('No rating of <%s> for "%s" found.', req.user.email, entity[titleAttr]), 404);
		}

		rating.value = req.body.value;
		rating.modified_at = new Date();

		rating.validate(function(err) {
			if (err) {
				return api.fail(res, error('Validations failed. See below for details.').errors(err.errors).warn('create'), 422);
			}

			rating.save(assert(function(rating) {

				updateRatedEntity(req, res, ref, assert, entity, rating, 200);
			}, 'Error saving rating.'));
		});
	});
}

/**
 * Updates an entity with new rating data.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {string} ref Reference name
 * @param {function} assert Assert object
 * @param {object} entity Found entity
 * @param {object} rating New rating
 * @param {int} status Success status, either 200 or 201.
 */
function updateRatedEntity(req, res, ref, assert, entity, rating, status) {

	metrics.onRatingUpdated(ref, entity, rating, assert(function(result) {

		// if not 201, add modified date
		if (status === 200) {
			result.modified_at = rating.modified_at;
			logger.log('[rating] User <%s> updated rating for %s %s to %s.', req.user, ref, entity.id, rating.value);
		} else {
			logger.log('[rating] User <%s> added new rating for %s %s with %s.', req.user, ref, entity.id, rating.value);
		}

		LogEvent.log(req, 'rate_' + ref, true, logPayload(rating, entity, ref, status == 200), logRefs(rating, entity, ref), function() {
			return api.success(res, result, status);
		});

	}, 'Error updating rated entity.'));
}

/**
 * Returns entity and rating for a given type.
 *
 * If entity is not found, a 404 is returned to the client and the callback isn't called.
 *
 * @param {Schema} Model model that can be rated
 * @param {string} ref Reference name
 * @param {string} [populate] If set, populates additional fields.
 * @returns {Function} function that takes req, res, assert and a callback which is launched with entity and rating as parameter
 */
function find(Model, ref, populate) {
	return function(req, res, assert, callback) {

		var query = Model.findOne({ id: req.params.id });
		if (populate) {
			query.populate(populate);
		}
		query.exec(assert(function(entity) {
			if (!entity) {
				return api.fail(res, error('No such %s with ID "%s"', ref, req.params.id), 404);
			}
			var q = { _from: req.user._id };
			q['_ref.' + ref] = entity._id;
			Rating.findOne(q, assert(function (rating) {
				callback(entity, rating);
			}, 'Error searching for current rating.'));
		}, 'Error finding ' + ref + ' in order to get rating from <%s>.'));
	};
}

function logPayload(rating, entity, type, updateOnly) {
	var payload =  { rating: _.pick(rating.toObject(), [ 'id', 'value' ]), updated: updateOnly };
	payload[type] = entity.toReduced();
	return payload;
}

function logRefs(star, entity, type) {
	var ref = {};
	ref[type] = star._ref[type]._id || star._ref[type];
	if (type === 'release') {
		ref.game = entity._game._id;
	}
	return ref;
}