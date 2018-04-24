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

import { Document, Types } from 'mongoose';
import { Context } from '../types/context';
import { User } from '../../users/user.type';

/**
 * A moderated entity
 */
export interface Moderated extends Document {

	moderation: ModerationData,
	_created_by: User | Types.ObjectId,

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
	 * @param {Moderated} entity Entity with moderation plugin enabled
	 * @return {Promise<ModerationData>} Moderation data
	 */
	handleModeration(ctx: Context, entity: Moderated): Promise<ModerationData>,

	/**
	 * Returns the query used for listing only approved entities.
	 * @param {Array | object} query
	 * @returns {Array | object}
	 */
	approvedQuery(query: Array<any> | object): Array<any> | object,

	/**
	 * Makes sure an API request has the permission to view the entity.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @returns {Promise.<Moderated>} This entity
	 */
	assertModeratedView(ctx: Context): Promise<Moderated>,

	/**
	 * If moderation field is demanded in request, populates it.
	 *
	 * @param {Application.Context} ctx Koa context
	 * @param {{includedFields: string[]}} opts Options
	 * @returns {Moderated | boolean} Populated entity if fields added, false otherwise.
	 */
	populateModeration(ctx: Context, opts: { includedFields: string[] }): Promise<Moderated | false>

	moderationChanged?(previousModeration: any, moderation: any): Promise<Moderated>,

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
	refuse(user: User, reason: string): Promise<ModerationData>,

	/**
	 * Sets the entity back to moderated
	 * @param {User|ObjectId} user User who reset to moderated
	 * @param {string} [message] Optional message
	 * @returns {Promise.<{}>} Updated moderation attribute
	 */
	moderate(user: User, message: string): Promise<ModerationData>,

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
		_created_by?: User | Types.ObjectId;
		created_by?: User;
	}[]
}