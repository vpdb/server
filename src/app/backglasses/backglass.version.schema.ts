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

import { Schema } from 'mongoose';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
export const backglassVersionFields = {
	version: { type: String, required: 'Version must be provided.' },
	changes: { type: String },
	_file:  { type: Schema.Types.ObjectId, required: 'You must provide a file reference.', ref: 'File' },
	released_at: { type: Date, required: true },
	counter: {
		downloads: { type: Number, default: 0 },
	},
};

export const backglassVersionSchema = new Schema(backglassVersionFields, { toObject: { virtuals: true, versionKey: false } });
backglassVersionSchema.plugin(fileReferencePlugin);
