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

import { assign, includes, isArray, isObject } from 'lodash';
import { Document, Model, ModeratedDocument, ModeratedModel, ModerationData, ModerationDataEvent, Schema } from 'mongoose';

import { LogEventUtil } from '../../log-event/log.event.util';
import { state } from '../../state';
import { UserDocument } from '../../users/user.document';
import { acl } from '../acl';
import { ApiError } from '../api.error';
import { logger } from '../logger';
import { Context } from '../typings/context';

const modelResourceMap: { [key: string]: string } = {
	Release: 'releases',
	Backglass: 'backglasses',
	Rom: 'roms',
};

const modelReferenceMap: { [key: string]: string } = {
	Release: 'release',
	Backglass: 'backglass',
	Rom: 'rom',
};

/**
 * A plugin that enables upload moderation for an entity.
 *
 * Users that don't have the `auto-approve` permission need a person with
 * the `approve` permission to manually sign it off.
 *
 * This plugin adds a `moderation` property to the entity and offers
 * methods to make querying easier.
 *
 * @param schema
 */
export function moderationPlugin(schema: Schema) {

	/*
	 * Add fields to entity
	 */
	schema.add({
		moderation: {
			is_approved: { type: Boolean, required: true, default: false },
			is_refused: { type: Boolean, required: true, default: false },
			auto_approved: { type: Boolean, required: true, default: false },
			history: [{
				event: { type: String, enum: ['approved', 'refused', 'pending'], required: true },
				message: { type: String },
				created_at: { type: Date },
				_created_by: { type: Schema.Types.ObjectId, ref: 'User' },
			}],
		},
	});

	/*
	 * Post save trigger that automatically approves if the creator has
	 * the "auto-approve" permission.
	 */
	schema.pre('save', async function(this: ModeratedDocument) {
		if (!this.isNew) {
			return;
		}
		// check if _created_by is a contributor and auto-approve.
		let user: UserDocument;
		/* istanbul ignore if */
		if (this.populated('_created_by')) {
			user = this._created_by as UserDocument;
		} else {
			user = await state.models.User.findOne({ _id: this._created_by }).exec();
		}

		const resource = modelResourceMap[(this.constructor as any).modelName];
		/* istanbul ignore if: Configuration error */
		if (!resource) {
			throw new Error('Tried to check moderation permission for unmapped entity "' + (this.constructor as any).modelName + '".');
		}
		const autoApprove = await acl.isAllowed(user.id, resource, 'auto-approve');
		if (autoApprove) {
			logger.info(null, '[moderationPlugin] Auto-approving %s "%s" for user <%s>.', (this.constructor as any).modelName, this.id, user.email);
			const now = new Date();
			this.moderation = {
				is_approved: true,
				is_refused: false,
				auto_approved: true,
				history: [{ event: 'approved', created_at: now, _created_by: user }],
			} as ModerationData;
		} else {
			this.moderation = {
				is_approved: false,
				is_refused: false,
				auto_approved: false,
				history: [],
			} as ModerationData;
		}

	});

	/**
	 * Returns the query used for listing only approved entities.
	 *
	 * Note that this can *add* entities to the result.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} query Current query
	 * @returns {Promise<T>} Moderated query
	 */
	schema.statics.handleModerationQuery = async function<T>(ctx: Context, query: T): Promise<T> {

		// no moderation filter requested, move on.
		if (!ctx.query || !ctx.query.moderation) {
			return addToQuery({ 'moderation.is_approved': true }, query);
		}

		if (!ctx.state.user) {
			throw new ApiError('Must be logged in order to retrieve moderated items.').status(401);
		}
		const resource = modelResourceMap[this.modelName];
		/* istanbul ignore if: configuration error */
		if (!resource) {
			logger.info(ctx.state, this);
			throw new Error('Tried to check moderation permission for unmapped entity "' + this.modelName + '".');
		}

		const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
		if (!isModerator) {
			throw new ApiError('Must be moderator in order to retrieved moderated items.').status(403);
		}

		const filters = ['refused', 'pending', 'auto_approved', 'manually_approved', 'all'];

		if (!includes(filters, ctx.query.moderation)) {
			throw new ApiError('Invalid moderation filter. Valid filters are: [ "' + filters.join('", "') + '" ].').status(400);
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
	 * @return {Promise<ModerationDataEvent>} Created moderation event
	 */
	schema.statics.handleModeration = async function(ctx: Context, entity: ModeratedDocument): Promise<ModerationDataEvent> {
		const actions = ['refuse', 'approve', 'moderate'];
		if (!ctx.request.body.action) {
			throw new ApiError().validationError('action', 'An action must be provided. Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		if (!includes(actions, ctx.request.body.action)) {
			throw new ApiError().validationError('action', 'Invalid action "' + ctx.request.body.action + '". Valid actions are: [ "' + actions.join('", "') + '" ].');
		}
		let moderationEvent: ModerationDataEvent;
		switch (ctx.request.body.action) {
			case 'refuse':
				if (!ctx.request.body.message) {
					throw new ApiError().validationError('message', 'A message must be provided when refusing.', ctx.request.body.message);
				}
				moderationEvent = await entity.refuse(ctx.state.user, ctx.request.body.message);
				break;

			case 'approve':
				moderationEvent = await entity.approve(ctx.state.user, ctx.request.body.message);
				break;

			case 'moderate':
				moderationEvent = await entity.moderate(ctx.state.user, ctx.request.body.message);
				break;
		}

		// event log
		const referenceName = modelReferenceMap[this.modelName];
		await LogEventUtil.log(ctx, 'moderate', false, {
			action: ctx.request.body.action,
			message: ctx.request.body.message,
		}, { [referenceName]: entity._id });

		return moderationEvent;
	};

	/**
	 * Makes sure the request has the right to retrieve the moderation field.
	 * @param {Context} ctx Koa context
	 */
	schema.statics.assertModerationField = async function(ctx: Context): Promise<void> {
		const resource = modelResourceMap[this.modelName];
		if (!ctx.state.user) {
			throw new ApiError('You must be logged in order to fetch moderation fields.').status(403);
		}
		const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
		if (!isModerator) {
			throw new ApiError('You must be moderator in order to fetch moderation fields.').status(403);
		}
	};

	/**
	 * Returns the query used for listing only approved entities.
	 * @param {T} query
	 * @returns {T}
	 */
	schema.statics.approvedQuery = <T>(query: T) => addToQuery({ 'moderation.is_approved': true }, query);

	/**
	 * Makes sure an API request has the permission to view the entity.
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise<ModeratedDocument>} This entity
	 */
	schema.methods.assertModeratedView = async function(this: ModeratedDocument, ctx: Context): Promise<ModeratedDocument> {

		const modelName = (this.constructor as any).modelName;
		const resource: string = modelResourceMap[modelName];
		const reference: string = modelReferenceMap[modelName];
		/* istanbul ignore if: configuration error */
		if (!resource) {
			throw new Error('Tried to check moderation permission for unmapped entity "' + modelName + '".');
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
		if (ctx.state.user._id.equals(this._created_by._id)) {
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
	 * @param {string[]} includedFields List of included fields from request query
	 * @returns {ModeratedDocument | boolean} Populated entity if fields added, false otherwise.
	 */
	schema.methods.populateModeration = async function(this: ModeratedDocument, ctx: Context, includedFields: string[]): Promise<ModeratedDocument | false> {

		const modelName = (this.constructor as any).modelName;
		const model = state.getModel<ModeratedModel<ModeratedDocument>>(modelName);
		const resource: string = modelResourceMap[modelName];
		if (includedFields.includes('moderation')) {
			await model.assertModerationField(ctx);
			return this.populate('moderation.history._created_by').execPopulate();

		} else {
			// if owner or moderator, don't populate but still return object so moderation fields aren't deleted
			if (ctx.state.user) {
				const isModerator = await acl.isAllowed(ctx.state.user.id, resource, 'moderate');
				if (isModerator || ctx.state.user._id.equals(this._created_by._id)) {
					return this;
				}
				return false;
			}
			return false;
		}
	};

	/**
	 * Marks the entity as approved.
	 * @param {UserDocument|ObjectId} user User who approved
	 * @param {string} [message] Optional message
	 * @returns {Promise<ModerationDataEvent>} Created moderation event
	 */
	schema.methods.approve = async function(user: UserDocument, message: string): Promise<ModerationDataEvent> {
		return await moderateEntity.bind(this)(
			this.constructor.modelName,
			user,
			message,
			'approved',
			true,
			false,
		);
	};

	/**
	 * Marks the entity as refused.
	 * @param {UserDocument|ObjectId} user User who refused
	 * @param {string} reason Reason why entity was refused
	 * @returns {Promise<ModerationDataEvent>} Created moderation event
	 */
	schema.methods.refuse = async function(user: UserDocument, reason: string): Promise<ModerationDataEvent> {
		return await moderateEntity.bind(this)(
			this.constructor.modelName,
			user,
			reason,
			'refused',
			false,
			true,
		);
	};

	/**
	 * Sets the entity back to moderated
	 * @param {UserDocument|ObjectId} user User who reset to moderated
	 * @param {string} [message] Optional message
	 * @returns {Promise<ModerationDataEvent>} Created moderation event
	 */
	schema.methods.moderate = async function(user: UserDocument, message: string): Promise<ModerationData> {
		return await moderateEntity.bind(this)(
			this.constructor.modelName,
			user,
			message,
			'pending',
			false,
			false,
		);
	};
}

/**
 * Sets the moderation status to a new value and adds it to the history.
 *
 * @param {string} modelName Name of the model
 * @param {UserDocument} user User performing the action
 * @param {string} message Message from the user
 * @param {string} eventName Name of the event
 * @param {boolean} isApproved True if new status is approved
 * @param {boolean} isRefused True if new status is refused
 * @returns {Promise<ModerationDataEvent>} Created moderation event
 */
async function moderateEntity(this: ModeratedDocument, modelName: string, user: UserDocument, message: string, eventName: string, isApproved: boolean, isRefused: boolean): Promise<ModerationDataEvent> {

	const model = state.getModel<ModeratedModel<ModeratedDocument>>(modelName);
	const previousModeration = { isApproved: this.moderation.is_approved, isRefused: this.moderation.is_refused };
	const event = {
		event: eventName,
		message,
		created_at: new Date(),
		_created_by: user._id,
	} as ModerationDataEvent;

	// update entity
	await model.findByIdAndUpdate(this._id, {
		'moderation.is_approved': isApproved,
		'moderation.is_refused': isRefused,
		$push: { 'moderation.history': event },
	}).exec();

	const entity = await model.findOne({ _id: this._id }).exec();

	// execute post hook if defined (typically used to update counters)
	if (entity.moderationChanged) {
		await entity.moderationChanged(previousModeration, { isApproved, isRefused });
	}
	return event;
}

/**
 * Adds a new condition to an existing query.
 *
 * The existing query can be an object, in which case the new condition ends
 * up as a new property, or an array, in which case it is added to the
 * array. Otherwise, just the condition is returned.
 *
 * @param {object} toAdd Query to add
 * @param {T} query Original query
 * @return {T} Merged query
 */
function addToQuery<T>(toAdd: object, query: T): T {
	if (isArray(query)) {
		query.push(toAdd);
		return query;
	}
	if (isObject(query)) {
		return assign(query, toAdd);
	}
	/* istanbul ignore next: Don't screw up when getting weird query objects, but that hasn't happened. */
	return query;
}

declare module 'mongoose' {

	// methods
	export interface ModeratedDocument extends Document {

		moderation: ModerationData;
		_created_by: UserDocument | Types.ObjectId;
		created_by?: UserDocument;

		/**
		 * Makes sure an API request has the permission to view the entity.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @returns {Promise<ModeratedDocument>} This entity
		 */
		assertModeratedView(ctx: Context): Promise<this>;

		/**
		 * If moderation field is demanded in request, populates it.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @param {string[]} includedFields List of included fields from request query
		 * @returns {ModeratedDocument | boolean} Populated entity if fields added, false otherwise.
		 */
		populateModeration(ctx: Context, includedFields: string[]): Promise<this | false>;

		/**
		 * Marks the entity as approved.
		 * @param {UserDocument|ObjectId} user User who approved
		 * @param {string} [message] Optional message
		 * @returns {Promise<ModerationDataEvent>} Created moderation event
		 */
		approve(user: UserDocument, message: string): Promise<ModerationDataEvent>;

		/**
		 * Marks the entity as refused.
		 * @param {UserDocument|ObjectId} user User who refused
		 * @param {string} reason Reason why entity was refused
		 * @returns {Promise<ModerationDataEvent>} Created moderation event
		 */
		refuse(user: UserDocument, reason: string): Promise<ModerationDataEvent>;

		/**
		 * Sets the entity back to moderated
		 * @param {UserDocument|ObjectId} user User who reset to moderated
		 * @param {string} [message] Optional message
		 * @returns {Promise<ModerationDataEvent>} Created moderation event
		 */
		moderate(user: UserDocument, message: string): Promise<ModerationDataEvent>;

		/**
		 * An optional hook executed when moderation changed.
		 *
		 * @param previousModeration Original moderation
		 * @param moderation New moderation
		 * @returns {Promise<ModeratedDocument>}
		 */
		moderationChanged?(previousModeration: { isApproved: boolean, isRefused: boolean }, moderation: { isApproved: boolean, isRefused: boolean }): Promise<ModeratedDocument>;
	}

	export interface ModerationData extends Document {
		is_approved: boolean;
		is_refused: boolean;
		auto_approved: boolean;
		history?: ModerationDataEvent[];
	}

	export interface ModerationDataEvent extends Document {
		event: 'approved' | 'refused' | 'pending';
		message?: string;
		created_at: Date;
		_created_by?: UserDocument | Types.ObjectId;
		created_by?: UserDocument;
	}

	// statics
	export interface ModeratedModel<T extends ModeratedDocument> extends Model<T> {
		/**
		 * Returns the query used for listing only approved entities.
		 *
		 * @param {Application.Context} ctx Koa context
		 * @param {T} query Current query
		 * @returns {Promise<T>} Moderated query
		 */
		handleModerationQuery<T>(ctx: Context, query: T): Promise<T>;

		/**
		 * Handles moderation requests from the API.
		 * @param {Application.Context} ctx Koa context
		 * @param {ModeratedDocument} entity Entity with moderation plugin enabled
		 * @return {Promise<ModerationDataEvent>} Created moderation event
		 */
		handleModeration(ctx: Context, entity: ModeratedDocument): Promise<ModerationDataEvent>;

		/**
		 * Makes sure the request has the right to retrieve the moderation field.
		 * @param {Context} ctx Koa context
		 */
		assertModerationField(ctx: Context): Promise<void>;

		/**
		 * Returns the query used for listing only approved entities.
		 * @param {T} query
		 * @returns {T} Updated query
		 */
		approvedQuery<T>(query: T): T;
	}

	export function model<T extends ModeratedDocument>(
		name: string,
		schema?: Schema,
		collection?: string,
		skipInit?: boolean): ModeratedModel<T>;
}
