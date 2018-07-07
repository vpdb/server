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

import { isString } from 'lodash';
import { PaginateModel, Schema } from 'mongoose';
import paginatePlugin = require('mongoose-paginate');
import validator from 'validator';
import { Comment } from './comment';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const commentFields = {
	id: { type: String, required: true, unique: true, default: shortId.generate },
	_from: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		release: { type: Schema.Types.ObjectId, ref: 'Release', index: true, sparse: true },
		release_moderation: { type: Schema.Types.ObjectId, ref: 'Release', index: true, sparse: true },
	},
	message: { type: String, required: 'You must provide a message when commenting.' },
	ip: { type: String, required: true },
	created_at: { type: Date, required: true },
};

export interface CommentModel extends PaginateModel<Comment> {}
export const commentSchema = new Schema(commentFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
commentSchema.plugin(paginatePlugin);

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
commentSchema.path('message').validate((msg: any) => {
	return isString(msg) && validator.isLength(msg, 3, 5000);
}, 'Message must be at least 3 chars and no longer than 5k characters.');
