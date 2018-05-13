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


import { Document, Schema } from 'mongoose';
import { User } from '../users/user';
import { Game } from '../games/game';
import { Release } from '../releases/release';
import { Medium } from '../media/medium';
import { Backglass } from '../backglasses/backglass';

export interface Star extends Document {
	_from: User | Schema.Types.ObjectId,
	_ref: {
		game: Game | Schema.Types.ObjectId,
		release: Release | Schema.Types.ObjectId,
		user: User | Schema.Types.ObjectId,
		medium: Medium | Schema.Types.ObjectId,
		backglass: Backglass | Schema.Types.ObjectId,
	},
	type: 'game' | 'release' | 'user' | 'medium' | 'backglass',
	created_at: Date
}