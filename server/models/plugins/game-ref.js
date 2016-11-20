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
	 * @param {array|object} [query] Query to append.
	 * @returns Promise.<{array|object}>
	 */
	schema.statics.handleGameQuery = function(req, query) {

		const reference = modelReferenceMap[this.modelName];
		const resource = modelResourceMap[this.modelName];

		if (!config.vpdb.restrictions[reference] || _.isEmpty(config.vpdb.restrictions[reference].denyMpu)) {
			return Promise.resolve(query);
		}

		const acl = require('../../acl');
		const Game = mongoose.model('Game');
		return Promise.try(() => {
			return req.user ? acl.isAllowed(req.user.id, resource, 'view-restriced') : false;

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
						{ 'authors._user': req.user._id },
						{ _game : { $nin: _.map(games, '_id') } }
					]}, query);

				} else {
					return addToQuery({ _game : { $nin: _.map(games, '_id') }}, query);
				}
			});
		});
	};

	/**
	 * Returns the query for listing only approved entities for a given game.
	 *
	 * @param {Request} req Request object
	 * @param {Game} game Game to fetch entities for.
	 * @param {array|object} [query] Query to append.
	 * @returns Promise.<{array|object|null}>
	 */
	schema.statics.restrictedQuery = function(req, game, query) {

		const acl = require('../../acl');
		const reference = modelReferenceMap[this.modelName];
		const resource = modelResourceMap[this.modelName];

		// if not restricted, return same query (no filter)
		if (!game.isRestricted(reference)) {
			return Promise.resolve(query);
		}

		// if restricted by not logged, return null (no results)
		if (!req.user) {
			return Promise.resolve(null);
		}

		// now we have a user, check if either moderator or owner
		return Promise.try(() => {
			return acl.isAllowed(req.user.id, resource, 'view-restriced');

		}).then(canViewRestricted => {

			// if moderator, return same query (no filter)
			if (canViewRestricted) {
				return query;
			}

			// if no moderator, only returned owned or authored entities
			return addToQuery({ $or: [ { _created_by: req.user._id }, { 'authors._user': req.user._id } ] }, query);
		});
	};

	/**
	 * Checks whether a user can access a given game.
	 *
	 * @param req Request containing user object
	 * @param game Game to check
	 * @param entity Entity that references the game. Needed to in order to check for owner.
	 * @return {Promise.<boolean>}
	 */
	schema.statics.hasRestrictionAccess = function(req, game, entity) {

		const acl = require('../../acl');
		const reference = modelReferenceMap[this.modelName];
		const resource = modelResourceMap[this.modelName];

		// if not restricted, has access
		if (!game.isRestricted(reference)) {
			return Promise.resolve(true);
		}

		// if restricted by not logged, no access.
		if (!req.user) {
			return Promise.resolve(false);
		}

		// now we have a user, check if either moderator or owner
		return Promise.try(() => {
			return acl.isAllowed(req.user.id, resource, 'view-restriced');

		}).then(isModerator => {

			// if moderator, has access
			if (isModerator) {
				return true;
			}

			// if no moderator, must be owner or author
			const createdBy = entity._created_by._id || entity._created_by;
			const authoredBy = entity.authors ? entity.authors.map(author => author._user._id || author._user) : [];
			return [...authoredBy, createdBy].reduce((a, id) => a || req.user._id.equals(id), false);
		});
	};

	/**
	 * --- still unused - remove if obsolete ---
	 *
	 * Returns true if the entity is restricted by its linked game.
	 * Note that the game must be populated, otherwise <tt>true</tt> will be returned.
	 *
	 * @return {boolean} True if linked game is restricted, false otherwise.
	 */
	schema.methods.isRestricted = function() {
		const reference = modelReferenceMap[this.constructor.modelName];
		if (!this._game.ipdb) {
			// game needs to be populated, so refuse if that's not the case
			return true;
		}
		return config.vpdb.restrictions[reference].denyMpu.includes(this._game.ipdb.mpu);
	}
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