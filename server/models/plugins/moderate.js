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
const logger = require('winston');
const mongoose = require('mongoose');
const acl = require('../../acl');
const Schema = mongoose.Schema;

const modelResourceMap = {
	Release: 'releases',
	Backglass: 'backglasses',
	Rom: 'roms'
};

/**
 * A plugin that enables upload moderation for an entity.
 *
 * Users that don't have the `auto-accept` permission need a person with
 * the `accept` permission to manually sign it off.
 *
 * This plugin adds a `moderation` property to the entity and offers
 * methods to make quering easier.
 *
 * @param schema
 */
module.exports = function(schema) {

	/*
	 * Add fields to entity
	 */
	schema.add({
		moderation: {
			is_accepted:    { type: Boolean, required: true, 'default': false },
			accepted_at:    { type: Date },
			_accepted_by:   { type: Schema.ObjectId, ref: 'User' },
			is_refused:     { type: Boolean, required: true, 'default': false },
			refused_at:     { type: Date },
			_refused_by:    { type: Schema.ObjectId, ref: 'User' },
			refused_reason: { type: String }
		}
	});

	/*
	 * Post save trigger that automatically accepts if the creator has
	 * the "auto-accept" permission.
	 */
	schema.pre('save', function(next) {
		if (!this.isNew) {
			return next();
		}
		// check if _created_by is a contributor and auto-accept.
		const User = mongoose.model('User');
		let user;
		return Promise.try(() => {
			if (this.populated('_created_by')) {
				return this._created_by;
			}
			return User.findOne({ _id: this._created_by }).exec();

		}).then(u => {
			user = u;
			const resource = modelResourceMap[this.constructor.modelName];
			if (!resource) {
				throw new Error('Tried to check moderation permission for unmapped entity "' + this.constructor.modelName + '".')
			}
			return acl.isAllowed(user.id, resource, 'auto-accept');

		}).then(autoAccept => {
			if (autoAccept) {
				logger.info('[moderation] Auto-accepting %s "%s" for user <%s>.', this.constructor.modelName, this.id, user.email);
				this.moderation = {
					is_accepted: true,
					is_refused: false,
					accepted_at: new Date(),
					_accepted_by: user._id
				};
			}

		}).nodeify(next);
	});

	/**
	 * Returns the query used for listing only accepted entities.
	 *
	 * @param {array|object} [query] Query to append.
	 * @returns {*}
	 */
	schema.statics.acceptedQuery = function(query) {
		return addToQuery({ 'moderation.is_accepted': true }, query);
	};

	/**
	 * Handles moderation requests from the API.
	 *
	 * @param {User} user Moderator user doing the request
	 * @param {object} requestBody Request body
	 * @param {object} entity Entity with moderation plugin enabled
	 * @param {Err} error Error wrapper for logging
	 * @returns {Promise}
	 */
	schema.statics.handleModeration = function(user, requestBody, entity, error) {
		const actions = ['refuse', 'accept', 'moderate'];
		if (!requestBody.action) {
			throw error('Validations failed.').validationError('action', 'An action must be provided. Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		if (!_.includes(actions, requestBody.action)) {
			throw error('Validations failed.').validationError('action', 'Invalid action "' + requestBody.action + '". Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		switch (requestBody.action) {
			case 'refuse':
				if (!requestBody.message) {
					throw error('Validations failed.').validationError('message', 'A message must be provided.', requestBody.message);
				}
				return entity.refuse(user, requestBody.message);

			case 'accept':
				return entity.accept(user);

			case 'moderate':
				return entity.moderate();
		}
	};

	/**
	 * Marks the entity as accepted.
	 * @param {User|ObjectId} user User who approved
	 * @returns {Promise}
	 */
	schema.methods.accept = function(user) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.update({ _id: this._id }, {
			moderation: {
				is_accepted: true,
				is_refused: false,
				accepted_at: new Date(),
				_accepted_by: user._id || user
			}
		});
	};

	/**
	 * Marks the entity as accepted.
	 * @param {User|ObjectId} user User who approved
	 * @param {string} reason Reason why entity was refused
	 * @returns {Promise}
	 */
	schema.methods.refuse = function(user, reason) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.update({ _id: this._id }, {
			moderation: {
				is_accepted: false,
				is_refused: true,
				refused_at: new Date(),
				_refused_by: user._id || user,
				refused_reason: reason
			}
		});
	};

	/**
	 * Sets the entity back to moderated
	 * @returns {Promise}
	 */
	schema.methods.moderate = function() {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.update({ _id: this._id }, {
			moderation: {
				is_accepted: false,
				is_refused: false
			}
		});
	};
};

/**
 * Returns the query used for listing only accepted entities.
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