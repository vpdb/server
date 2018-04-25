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
import { User } from '../users/user.type';
import { Game } from '../games/game.type';
import { Release } from '../releases/release.type';
import { Backglass } from '../backglasses/backglass.type';
import { GameRequest } from '../game-requests/game.request.type';
import { Build } from '../builds/build.type';

export interface LogEvent extends Document {
	_actor: User | Schema.Types.ObjectId,
	_ref: {
		game?: Game | Schema.Types.ObjectId,
		release?: Release | Schema.Types.ObjectId,
		backglass?: Backglass | Schema.Types.ObjectId,
		user?: User | Schema.Types.ObjectId,
		game_request?: GameRequest | Schema.Types.ObjectId,
		build?: Build | Schema.Types.ObjectId,
	},
	event: string,
	payload: any,
	is_public: boolean,
	ip: string,
	logged_at: Date
}