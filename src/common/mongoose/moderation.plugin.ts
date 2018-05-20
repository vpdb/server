/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

import mongoose, { Document, Model, ModeratedDocument, ModeratedModel, ModeratedSchema, Schema, ModerationData } from 'mongoose';
import { assign, includes, isArray, isObject } from 'lodash';

import { state } from '../../state';
import { Context } from '../types/context';
import { User } from '../../users/user';
import { ApiError } from '../api.error';
import { logger } from '../logger';

const modelResourceMap: { [key: string]: string } = {
	Release: 'releases',
	Backglass: 'backglasses',
	Rom: 'roms'
};

const modelReferenceMap: { [key: string]: string } = {
	Release: 'release',
	Backglass: 'backglass',
	Rom: 'rom'
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
export function moderationPlugin(schema: Schema) {

	/*
	 * Add fields to entity
	 */
	schema.add({
		moderation: {
			is_approved: { type: Boolean, required: true, 'default': false },
			is_refused: { type: Boolean, required: true, 'default': false },
			auto_approved: { type: Boolean, required: true, 'default': false },
			history: [{
				event: { type: String, 'enum': ['approved', 'refused', 'pending'], required: true },
				message: { type: String },
				created_at: { type: Date },
				_created_by: { type: Schema.Types.ObjectId, ref: 'User' }
			}]
		}
	});

	/*
	 * Post save trigger that automatically approves if the creator has
	 * the "auto-approve" permission.
	 */
	schema.pre('save', async function (this: ModeratedDocument) {
		if (!this.isNew) {
			return;
		}
		// check if _created_by is a contributor and auto-approve.
		const acl = require('../acl');
		const User = state.models.User;
		let user: User;
		if (this.populated('_created_by')) {
			user = this._created_by as User;
		} else {
			user = await User.findOne({ _id: this._created_by }).exec();
		}

		const resource = modelResourceMap[this.modelName];
		if (!resource) {
			throw new Error('Tried to check moderation permission for unmapped entity "' + this.modelName + '".');
		}
		const autoApprove = await acl.isAllowed(user.id, resource, 'auto-approve');
		if (autoApprove) {
			logger.info('[moderation] Auto-approving %s "%s" for user <%s>.', this.modelName, this.id, user.email);
			const now = new Date();
			this.moderation = {
				is_approved: true,
				is_refused: false,
				auto_approved: true,
				history: [{ event: 'approved', created_at: now, _created_by: user }]
			} as ModerationData;
			if (this.postApprove) {
				return this.postApprove();
			}
		} else {
			this.moderation = {
				is_approved: false,
				is_refused: false,
				auto_approved: false,
				history: []
			} as ModerationData;
		}

	});

	/**
	 * Returns the query used for listing only approved entities.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @param {Array|object} query Current query
	 * @returns {Promise<Array|object>} Moderated query
	 */
	schema.statics.handleModerationQuery = async function (ctx: Context, query: Array<any> | object): Promise<Array<any> | object> {
		const acl = require('../acl');
		let isModerator = false;
		if (ctx.query && ctx.query.moderation) {
			if (!ctx.state.user) {
				throw new ApiError('Must be logged in order to retrieve moderated items.').status(401);
			}
			const resource = modelResourceMap[this.modelName];
			if (!resource) {
				logger.info(this);
				throw new Error('Tried to check moderation permission for unmapped entity "' + this.modelName + '".');
			}
			isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
		}

		if (!ctx.query || !ctx.query.moderation) {
			return addToQuery({ 'moderation.is_approved': true }, query);
		}
		if (!isModerator) {
			throw new ApiError('Must be moderator in order to retrieved moderated items.').status(403);
		}

		const filters = ['refused', 'pending', 'auto_approved', 'manually_approved', 'all'];

		if (!includes(filters, ctx.query.moderation)) {
			throw new ApiError('Invalid moderation filter. Valid filters are: [ "' + filters.join('", "') + '" ].').status(403);
		}
		switch (ctx.query.moderation) {
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
	};

	/**
	 * Handles moderation requests from the API.
	 * @param {Application.Context} ctx Koa context
	 * @param {ModeratedDocument} entity Entity with moderation plugin enabled
	 * @return {Promise<ModerationData>} Moderation data
	 */
	schema.statics.handleModeration = async function (ctx: Context, entity: ModeratedDocument): Promise<ModerationData> {
		const LogEvent = require('mongoose').model('LogEvent');
		const actions = ['refuse', 'approve', 'moderate'];
		if (!ctx.request.body.action) {
			throw new ApiError('Validations failed.').validationError('action', 'An action must be provided. Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		if (!includes(actions, ctx.request.body.action)) {
			throw new ApiError('Validations failed.').validationError('action', 'Invalid action "' + ctx.request.body.action + '". Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		let moderation: ModerationData;
		switch (ctx.request.body.action) {
			case 'refuse':
				if (!ctx.request.body.message) {
					throw new ApiError('Validations failed.').validationError('message', 'A message must be provided when refusing.', ctx.request.body.message);
				}
				moderation = await entity.refuse(ctx.state.user, ctx.request.body.message);
				break;

			case 'approve':
				moderation = await entity.approve(ctx.state.user, ctx.request.body.message);
				break;

			case 'moderate':
				moderation = await entity.moderate(ctx.state.user, ctx.request.body.message);
				break;
		}

		// event log
		const referenceName = modelReferenceMap[this.modelName];
		LogEvent.log(ctx, 'moderate', false, {
			action: ctx.request.body.action,
			message: ctx.request.body.message
		}, { [referenceName]: entity._id });

		return moderation;
	};

	/**
	 * Returns the query used for listing only approved entities.
	 * @param {Array | object} query
	 * @returns {Array | object}
	 */
	schema.statics.approvedQuery = function (query: Array<any> | object): Array<any> | object {
		return addToQuery({ 'moderation.is_approved': true }, query);
	};

	/**
	 * Makes sure an API request has the permission to view the entity.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise.<ModeratedDocument>} This entity
	 */
	schema.methods.assertModeratedView = async function (ctx: Context): Promise<ModeratedDocument> {

		const acl = require('../acl');
		const resource: string = modelResourceMap[this.constructor.modelName];
		const reference: string = modelReferenceMap[this.constructor.modelName];
		if (!resource) {
			throw new Error('Tried to check moderation permission for unmapped entity "' + this.constructor.modelName + '".');
		}

		// if approved, all okay.
		if (this.moderation.is_approved) {
			return this;
		}

		// otherwise, user needs to be logged
		if (!ctx.state.user) {
			throw new ApiError('No such %s with ID "%s"', reference, ctx.params.id).status(404);
		}

		// if viewing own entity, okay
		if (ctx.state.user._id.equals(this._created_by._id || this._created_by)) {
			return this;
		}

		// if user is moderator, also okay.
		const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
		if (isModerator) {
			return this;
		}
		throw new ApiError('No such %s with ID "%s"', reference, ctx.params.id).status(404);
	};

	/**
	 * If moderation field is demanded in request, populates it.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @param {{includedFields: string[]}} opts Options
	 * @returns {ModeratedDocument | boolean} Populated entity if fields added, false otherwise.
	 */
	schema.methods.populateModeration = async function (ctx: Context, opts: { includedFields: string[] }): Promise<ModeratedDocument | false> {
		const acl = require('../acl');
		const resource: string = modelResourceMap[this.constructor.modelName];
		if (opts.includedFields.includes('moderation')) {
			if (!ctx.state.user) {
				throw new ApiError('You must be logged in order to fetch moderation fields.').status(403);
			}
			const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
			if (!isModerator) {
				throw new ApiError('You must be moderator in order to fetch moderation fields.').status(403);
			}
			return await this.populate('moderation.history._created_by').execPopulate();

		} else {
			// if owner or moderator, don't populate but still return object so moderation fields aren't deleted
			if (ctx.state.user) {
				const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
				if (isModerator || ctx.state.user._id.equals(this._created_by._id || this._created_by)) {
					return this;
				}
				return false;
			}
			return false;
		}
	};

	/**
	 * Marks the entity as approved.
	 * @param {User|ObjectId} user User who approved
	 * @param {string} [message] Optional message
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.methods.approve = async function (user: User, message: string): Promise<ModerationData> {

		const model = mongoose.model<ModeratedDocument>(this.constructor.modelName);
		let previousModeration = { isApproved: this.moderation.is_approved, isRefused: this.moderation.is_refused };
		await model.findByIdAndUpdate(this._id, {
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

		let entity = await model.findOne({ _id: this._id }).exec();
		if (entity.moderationChanged) {
			entity = await entity.moderationChanged(previousModeration, { isApproved: true, isRefused: false });
		}
		return entity.moderation
	};

	/**
	 * Marks the entity as refused.
	 * @param {User|ObjectId} user User who refused
	 * @param {string} reason Reason why entity was refused
	 ** @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.methods.refuse = async function (user: User, reason: string): Promise<ModerationData> {

		const model = mongoose.model<ModeratedDocument>(this.constructor.modelName);
		let previousModeration = { isApproved: this.moderation.is_approved, isRefused: this.moderation.is_refused };
		await model.findByIdAndUpdate(this._id, {
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

		let entity = await model.findOne({ _id: this._id }).exec();
		if (entity.moderationChanged) {
			entity = await entity.moderationChanged(previousModeration, { isApproved: false, isRefused: true });
		}
		return entity.moderation;
	};

	/**
	 * Sets the entity back to moderated
	 * @param {User|ObjectId} user User who reset to moderated
	 * @param {string} [message] Optional message
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	schema.methods.moderate = async function (user: User, message: string): Promise<ModerationData> {

		const model = mongoose.model<ModeratedDocument>(this.constructor.modelName);
		let previousModeration = { isApproved: this.moderation.is_approved, isRefused: this.moderation.is_refused };
		await model.findByIdAndUpdate(this._id, {
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
		}).exec();

		let entity: ModeratedDocument = await model.findOne({ _id: this._id }).exec();
		if (entity.moderationChanged) {
			entity = await entity.moderationChanged(previousModeration, { isApproved: false, isRefused: false });
		}
		return entity.moderation;
	};
}

/**
 * Adds a new condition to an existing query.
 *
 * The existing query can be an object, in which case the new condition ends
 * up as a new property, or an array, in which case it is added to the
 * array. Otherwise, just the condition is returned.
 *
 * @param {object} toAdd Query to add
 * @param {Array<any> | object} query Original query
 * @return {Array<any> | object} Merged query
 */
function addToQuery(toAdd: object, query: Array<any> | object): Array<any> | object {
	if (isArray(query)) {
		query.push(toAdd);
		return query;
	}
	if (isObject(query)) {
		return assign(query, toAdd);
	}
	return toAdd;
}

declare module 'mongoose' {

	// methods
	export interface ModeratedDocument extends Document {

		moderation: ModerationData;
		_created_by: User | Schema.Types.ObjectId;
		created_by?: User;

		/**
		 * Makes sure an API request has the permission to view the entity.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @returns {Promise.<ModeratedDocument>} This entity
		 */
		assertModeratedView(ctx: Context): Promise<ModeratedDocument>;

		/**
		 * If moderation field is demanded in request, populates it.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @param {{includedFields: string[]}} opts Options
		 * @returns {ModeratedDocument | boolean} Populated entity if fields added, false otherwise.
		 */
		populateModeration(ctx: Context, opts: { includedFields: string[] }): Promise<ModeratedDocument | false>;

		/**
		 * Marks the entity as approved.
		 * @param {User|ObjectId} user User who approved
		 * @param {string} [message] Optional message
		 * @returns {Promise.<{}>} Updated moderation attribute
		 */
		approve(user: User, message: string): Promise<ModerationData>,

		/**
		 * Marks the entity as refused.
		 * @param {User|ObjectId} user User who refused
		 * @param {string} reason Reason why entity was refused
		 ** @returns {Promise.<{}>} Updated moderation attribute
		 */
		refuse(user: User, reason: string): Promise<ModerationData>;

		/**
		 * Sets the entity back to moderated
		 * @param {User|ObjectId} user User who reset to moderated
		 * @param {string} [message] Optional message
		 * @returns {Promise.<{}>} Updated moderation attribute
		 */
		moderate(user: User, message: string): Promise<ModerationData>;

		/**
		 * An optional hook executed when moderation changed.
		 *
		 * @param previousModeration Original moderation
		 * @param moderation New moderation
		 * @returns {Promise<ModeratedDocument>}
		 */
		moderationChanged?(previousModeration: { isApproved: boolean, isRefused: boolean }, moderation: { isApproved: boolean, isRefused: boolean }): Promise<ModeratedDocument>;

		/**
		 * An optional hook executed when the moderation was approved.
		 */
		postApprove?(): void
	}

	export interface ModerationData extends Document {
		is_approved: boolean;
		is_refused: boolean;
		auto_approved: boolean;
		history?: {
			event: 'approved' | 'refused' | 'pending';
			message?: string;
			created_at: Date;
			_created_by?: User | Schema.Types.ObjectId;
			created_by?: User;
		}[]
	}

	// statics
	export interface ModeratedModel<T extends ModeratedDocument> extends Model<T> {
		/**
		 * Returns the query used for listing only approved entities.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @param {Array|object} query Current query
		 * @returns {Promise<Array|object>} Moderated query
		 */
		handleModerationQuery(ctx: Context, query: Array<any> | object): Promise<Array<any> | object>,

		/**
		 * Handles moderation requests from the API.
		 * @param {Application.Context} ctx Koa context
		 * @param {ModeratedDocument} entity Entity with moderation plugin enabled
		 * @return {Promise<ModerationData>} Moderation data
		 */
		handleModeration(ctx: Context, entity: ModeratedDocument): Promise<ModerationData>,

		/**
		 * Returns the query used for listing only approved entities.
		 * @param {Array | object} query
		 * @returns {Array | object}
		 */
		approvedQuery(query: Array<any> | object): Array<any> | object,
	}

	export interface ModeratedSchema extends Schema {
		//plugin(plugin: (schema: ModeratedSchema, options?: any) => void, options?: ModeratedSchema): this;
	}

	export function model<T extends ModeratedDocument>(
		name: string,
		schema?: ModeratedSchema,
		collection?: string,
		skipInit?: boolean): ModeratedModel<T>;
}

