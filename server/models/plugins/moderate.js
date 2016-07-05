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
 * Users that don't have the `auto-approve` permission need a person with
 * the `approve` permission to manually sign it off.
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
			is_approved:    { type: Boolean, required: true, 'default': false },
			is_refused:     { type: Boolean, required: true, 'default': false },
			auto_approved:  { type: Boolean, required: true, 'default': false },
			history: [{
				event:       { type: String, 'enum': ['approved', 'refused', 'moderated'], required: true },
				message:     { type: String },
				created_at:  { type: Date },
				_created_by: { type: Schema.ObjectId, ref: 'User' }
			}]
		}
	});

	/*
	 * Post save trigger that automatically approves if the creator has
	 * the "auto-approve" permission.
	 */
	schema.pre('save', function(next) {
		if (!this.isNew) {
			return next();
		}
		// check if _created_by is a contributor and auto-approve.
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
			return acl.isAllowed(user.id, resource, 'auto-approve');

		}).then(autoApprove => {
			if (autoApprove) {
				logger.info('[moderation] Auto-approving %s "%s" for user <%s>.', this.constructor.modelName, this.id, user.email);
				const now = new Date();
				this.moderation = {
					is_approved: true,
					is_refused: false,
					auto_approved: true,
					history: [ { event: 'approved', created_at: now, _created_by: user } ]
				};
			} else {
				this.moderation = {
					is_approved: false,
					is_refused: false,
					auto_approved: false,
					history: [ ]
				};
			}

		}).nodeify(next);
	});

	/**
	 * Returns the query used for listing only approved entities.
	 *
	 * @param {array|object} [query] Query to append.
	 * @returns {*}
	 */
	schema.statics.approvedQuery = function(query) {
		return addToQuery({ 'moderation.is_approved': true }, query);
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
		const actions = ['refuse', 'approve', 'moderate'];
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

			case 'approve':
				return entity.approve(user, requestBody.message);

			case 'moderate':
				return entity.moderate(requestBody.message);
		}
	};

	/**
	 * Marks the entity as approved.
	 * @param {User|ObjectId} user User who approved
	 * @param {string} [message] Optional message
	 * @returns {Promise}
	 */
	schema.methods.approve = function(user, message) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.findByIdAndUpdate(this._id, {
			'moderation.is_approved': true,
			'moderation.is_refused': false,
			$push: {
				'moderation.history': {
					event: 'approved',
					message: message,
					created_at: new Date(),
					_created_by: user._id || user
				}
			}
		}).exec();
	};

	/**
	 * Marks the entity as refused.
	 * @param {User|ObjectId} user User who refused
	 * @param {string} reason Reason why entity was refused
	 * @returns {Promise}
	 */
	schema.methods.refuse = function(user, reason) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.findByIdAndUpdate(this._id, {
			'moderation.is_approved': false,
			'moderation.is_refused': true,
			$push: {
				'moderation.history': {
					event: 'refused',
					message: reason,
					created_at: new Date(),
					_created_by: user._id || user
				}
			}
		}).exec();
	};

	/**
	 * Sets the entity back to moderated
	 * @param {string} [message] Optional message
	 * @returns {Promise}
	 */
	schema.methods.moderate = function(message) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.findByIdAndUpdate(this._id, {
			'moderation.is_approved': false,
			'moderation.is_refused': false,
			$push: {
				'moderation.history': {
					event: 'moderated',
					message: message,
					created_at: new Date(),
					_created_by: user._id || user
				}
			}
		}).exec();
	};
};

/**
 * Returns the query used for listing only approved entities.
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