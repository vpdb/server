/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

import { isNumber } from 'lodash';
import { Schema } from 'mongoose';

const shortId = require('shortid32');

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const ratingFields = {
	id: { type: String, required: true, unique: true, default: shortId.generate },
	_from: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		game: { type: Schema.Types.ObjectId, ref: 'Game', index: true, sparse: true },
		release: { type: Schema.Types.ObjectId, ref: 'Release', index: true, sparse: true },
	},
	value: { type: Number, required: 'You must provide a value when rating.' },
	modified_at: { type: Date },
	created_at: { type: Date, required: true },
};

export const ratingSchema = new Schema(ratingFields, { toObject: { virtuals: true, versionKey: false } });
// TODO autoindex: false in production: http://mongoosejs.com/docs/guide.html#indexes

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
ratingSchema.path('value').validate((val: any) => {
	return isNumber(val) && val % 1 === 0;
}, 'Value must be an integer.');

ratingSchema.path('value').validate((val: any) => {
	return val > 0 && val <= 10;
}, 'Value must be between 1 and 10.');
