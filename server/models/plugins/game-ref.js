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

const _ = require('lodash');
const mongoose = require('mongoose');
const acl = require('../../acl');
const Schema = mongoose.Schema;

const config = require('../../modules/settings').current;

const modelResourceMap = {
	Release: 'releases',
	Backglass: 'backglasses',
	Rom: 'roms'
};

const modelReferenceMap = {
	Release: 'release',
	Backglass: 'backglass',
	Rom: 'rom'
};

/**
 * A plugin that enables links an entity to a game.
 *
 * Main reason for doing a plugin are the helper methods when filtering.
 *
 * @param schema
 * @param options
 */
module.exports = function(schema, options) {

	options = options || {};

	/*
	 * Add fields to entity
	 */
	if (options.isOptional) {
		schema.add({ _game: { type: Schema.ObjectId, ref: 'Game' } });
	} else {
		schema.add({ _game: { type: Schema.ObjectId, required: 'Reference to game must be provided.', ref: 'Game' } });
	}

	/**
	 * Returns the query used for listing only approved entities.
	 *
	 * @param {Request} req Request object
	 * @param {Err} error Error wrapper for logging
	 * @param {array|object} [query] Query to append.
	 * @returns {Promise}
	 */
	schema.statics.handleGameQuery = function(req, error, query) {

		const reference = modelReferenceMap[this.modelName];
		const resource = modelResourceMap[this.modelName];

		if (!config.vpdb.restrictions[reference] || _.isEmpty(config.vpdb.restrictions[reference].denyMpu)) {
			return Promise.resolve(query);
		}

		const Game = mongoose.model('Game');
		return Promise.try(() => {
			return req.user ? acl.isAllowed(req.user.id, resource, 'moderate') : false;

		}).then(isModerator => {

			// if moderator, don't filter.
			if (isModerator) {
				return query;
			}

			// find restricted games
			return Game.find({ 'ipdb.mpu' : { $in: config.vpdb.restrictions[reference].denyMpu }}).exec().then(games => {

				if (req.user) {
					return addToQuery({ $or: [
						{ _created_by: req.user._id },
						{ _game : { $nin: _.map(games, '_id') } }
					]}, query);

				} else {
					return addToQuery({ _game : { $nin: _.map(games, '_id') }}, query);
				}
			});
		});
	};

};

/**
 * Adds a new condition to an existing query.
 *
 * The existing query can be an object, in which case the new condition ends
 * up as a new property, or an array, in which case it is added to the
 * array. Otherwise, just the condition is returned.
 *
 * @param {object} toAdd Query to add
 * @param {array|object} [query] Original query
 * @returns {*}
 */
function addToQuery(toAdd, query) {
	if (_.isArray(query)) {
		query.push(toAdd);
		return query;
	}
	if (_.isObject(query)) {
		return  _.assign(query, toAdd);
	}
	return toAdd;
}