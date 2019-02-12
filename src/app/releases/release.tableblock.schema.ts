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
export const tableBlockFields = {
	hash:  { type: Buffer, required: true, unique: true, index: true },
	bytes: { type: Number, required: true },
	type:  { type: String, required: true, enum: [ 'image', 'sound', 'gameitem', 'collection' ] },
	meta:  { type: Schema.Types.Mixed },
	_files: { type: [ Schema.Types.ObjectId ], ref: 'File', index: true },
};
export const tableBlockSchema = new Schema(tableBlockFields);
