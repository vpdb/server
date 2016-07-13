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
				event:       { type: String, 'enum': ['approved', 'refused', 'pending'], required: true },
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
				throw new Error('Tried to check moderation permission for unmapped entity "' + this.constructor.modelName + '".');
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
				if (this.postApprove) {
					return this.postApprove();
				}
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
	 * @param {Request} req Request object
	 * @param {Err} error Error wrapper for logging
	 * @param {array|object} [query] Query to append.
	 * @returns {Promise}
	 */
	schema.statics.handleListQuery = function(req, error, query) {

		return Promise.try(() => {
			if (req.query && req.query.moderation) {
				if (!req.user) {
					throw error('Must be logged in order to retrieve moderated items.').status(401);
				}
				const resource = modelResourceMap[this.modelName];
				if (!resource) {
					console.log(this);
					throw new Error('Tried to check moderation permission for unmapped entity "' + this.modelName + '".');
				}
				return acl.isAllowed(req.user.id, resource, 'moderate');
			}
			return false;

		}).then(isModerator => {

			if (!req.query || !req.query.moderation) {
				return addToQuery({ 'moderation.is_approved': true }, query);
			}
			if (!isModerator) {
				throw error('Must be moderator in order to retrieved moderated items.').status(403);
			}

			const filters = ['refused', 'pending', 'auto_approved', 'manually_approved', 'all'];

			if (!_.includes(filters, req.query.moderation)) {
				throw error('Invalid moderation filter. Valid filters are: [ "' + filters.join('", "') + '" ].').status(403);
			}
			switch (req.query.moderation) {
				case 'refused':
					return addToQuery({ 'moderation.is_refused': true }, query);

				case 'pending':
					query = addToQuery({ 'moderation.is_approved': false }, query);
					return addToQuery({ 'moderation.is_refused': false }, query);

				case 'auto_approved':
					query = addToQuery({ 'moderation.is_approved': true }, query);
					return addToQuery({ 'moderation.auto_approved': true }, query);

				case 'manually_approved':
					query = addToQuery({ 'moderation.is_approved': true }, query);
					return addToQuery({ 'moderation.auto_approved': false }, query);

				case 'all':
					return query;
			}
		});
	};

	/**
	 * Handles moderation requests from the API.
	 *
	 * @param {Request} req Request object
	 * @param {Err} error Error wrapper for logging
	 * @param {object} entity Entity with moderation plugin enabled
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.statics.handleModeration = function(req, error, entity) {
		const actions = ['refuse', 'approve', 'moderate'];
		if (!req.body.action) {
			throw error('Validations failed.').validationError('action', 'An action must be provided. Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		if (!_.includes(actions, req.body.action)) {
			throw error('Validations failed.').validationError('action', 'Invalid action "' + req.body.action + '". Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		switch (req.body.action) {
			case 'refuse':
				if (!req.body.message) {
					throw error('Validations failed.').validationError('message', 'A message must be provided when refusing.', req.body.message);
				}
				return entity.refuse(req.user, req.body.message);

			case 'approve':
				return entity.approve(req.user, req.body.message);

			case 'moderate':
				return entity.moderate(req.user, req.body.message);
		}
	};

	/**
	 * Returns the query used for listing only approved entities.
	 * @param {array|object} [query] Query
	 * @returns {*}
	 */
	schema.statics.approvedQuery = function(query) {
		return addToQuery({ 'moderation.is_approved': true }, query);
	};

	/**
	 * Makes sure an API request has the permission to view the entity and populates
	 * the moderation field if demanded.
	 *
	 * @param {Request} req Request object
	 * @param {Err} error Error wrapper for logging
	 * @returns {Promise}
	 */
	schema.methods.assertModeratedView = function(req, error) {

		const resource = modelResourceMap[this.constructor.modelName];
		if (!resource) {
			throw new Error('Tried to check moderation permission for unmapped entity "' + this.constructor.modelName + '".');
		}

		// if approved, all okay.
		if (this.moderation.is_approved) {
			return Promise.resolve(this);
		}

		// otherwise, user needs to be logged
		if (!req.user) {
			return Promise.reject(error('No such release with ID "%s"', req.params.id).status(404));
		}

		// if viewing own entity, okay
		if (req.user._id.equals(this._created_by)) {
			return Promise.resolve(this);
		}

		// if user is moderator, also okay.
		return acl.isAllowed(req.user.id, resource, 'moderate').then(isModerator => {

			if (isModerator) {
				return this;
			}
			throw error('No such release with ID "%s"', req.params.id).status(404);
		});
	};

	/**
	 * If moderation field is demanded in request, populates it.
	 * @param {Request} req Request object
	 * @param {Err} error Error wrapper for logging
	 * @returns {Promise.<{}|false>} Populated entity if fields added, false otherwise.
	 */
	schema.methods.populateModeration = function(req, error) {
		const resource = modelResourceMap[this.constructor.modelName];
		let fields = req.query && req.query.fields ? req.query.fields.split(',') : [];
		if (fields.includes('moderation')) {
			if (!req.user) {
				throw error('You must be logged in order to fetch moderation fields.').status(403);
			}
			return acl.isAllowed(req.user.id, resource, 'moderate').then(isModerator => {
				if (!isModerator) {
					throw error('You must be moderator in order to fetch moderation fields.').status(403);
				}
				return this.populate('moderation.history._created_by').execPopulate();
			});
		} else {
			return Promise.resolve(false);
		}
	};

	/**
	 * Returns the moderation property API-stripped.
	 * @returns {{}}
	 */
	schema.methods.moderationToObject = function() {
		let moderation = this.moderation.toObject();
		moderation.history = this.moderation.history.map(h => {
			let historyItem = h.toObject();
			if (h._created_by.toReduced) {
				historyItem.created_by = h._created_by.toReduced();
			}
			delete historyItem._created_by;
			delete historyItem.id;
			delete historyItem._id;
			return historyItem;
		});
		moderation.history = _.orderBy(moderation.history, ['created_at'], ['desc']);
		return moderation;
	};

	/**
	 * Marks the entity as approved.
	 * @param {User|ObjectId} user User who approved
	 * @param {string} [message] Optional message
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.methods.approve = function(user, message) {

		const Model = mongoose.model(this.constructor.modelName);
		let moderation;
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
		})
		.exec()
		.then(() => Model.findOne({ _id: this._id }).exec())
		.then(entity => {
			moderation = entity.moderation;
			if (entity.postApprove) {
				return entity.postApprove();
			}
		}).then(() => moderation);
	};

	/**
	 * Marks the entity as refused.
	 * @param {User|ObjectId} user User who refused
	 * @param {string} reason Reason why entity was refused
	 ** @returns {Promise.<{}>} Updated moderation attribute
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
		})
		.exec()
		.then(() => Model.findOne({ _id: this._id }).exec())
		.then(entity => entity.moderation);
	};

	/**
	 * Sets the entity back to moderated
	 * @param {User|ObjectId} user User who reset to moderated
	 * @param {string} [message] Optional message
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.methods.moderate = function(user, message) {

		const Model = mongoose.model(this.constructor.modelName);
		return Model.findByIdAndUpdate(this._id, {
			'moderation.is_approved': false,
			'moderation.is_refused': false,
			$push: {
				'moderation.history': {
					event: 'pending',
					message: message,
					created_at: new Date(),
					_created_by: user._id || user
				}
			}
		})
		.exec()
		.then(() => Model.findOne({ _id: this._id }).exec())
		.then(entity => entity.moderation);
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