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
import { Schema } from 'mongoose';
import validator from 'validator';
import { state } from '../state';

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const tagFields = {
	_id: { type: String, required: true },
	name: { type: String, required: 'Name must be provided.', unique: true },
	description: { type: String, required: 'Description must be provided.' },
	is_active: { type: Boolean, required: true, default: false },
	created_at: { type: Date, required: true },
	_created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
};
export const tagSchema = new Schema(tagFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------
tagSchema.virtual('id')
	.get(function() {
		return this._id;
	});

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
tagSchema.path('name').validate((name: any) =>  {
	return isString(name) && validator.isLength(name ? name.trim() : '', 2);
}, 'Name must contain at least two characters.');

tagSchema.path('name').validate(async (name: any) =>  {
	const tag = await state.models.Tag.findOne({ name }).exec();
	return !tag;
}, 'The {PATH} "{VALUE}" is already taken.');

tagSchema.path('description').validate((description: any) =>  {
	return isString(description) && validator.isLength(description ? description.trim() : description, 5);
}, 'Name must contain at least 5 characters.');
