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
import { Schema } from 'mongoose';

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

export const starFields = {
	_from: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
	_ref: {
		game: { type: Schema.Types.ObjectId, ref: 'Game', index: true, sparse: true },
		release: { type: Schema.Types.ObjectId, ref: 'Release', index: true, sparse: true },
		user: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
		medium: { type: Schema.Types.ObjectId, ref: 'Medium', index: true, sparse: true },
		backglass: { type: Schema.Types.ObjectId, ref: 'Backglass', index: true, sparse: true },
	},
	type: { type: String, enum: ['game', 'release', 'user', 'medium', 'backglass'], required: true, index: true },
	created_at: { type: Date, required: true },
};

export const starSchema = new Schema(starFields, { toObject: { virtuals: true, versionKey: false } });
// TODO autoindex: false in production: http://mongoosejs.com/docs/guide.html#indexes
