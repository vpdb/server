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
import { Backglass } from '../backglasses/backglass';
import { Build } from '../builds/build';
import { GameRequest } from '../game-requests/game.request';
import { Game } from '../games/game';
import { Release } from '../releases/release';
import { User } from '../users/user';

export interface LogEvent extends Document {
	_actor: User | Types.ObjectId;
	_ref: {
		game?: Game | Types.ObjectId;
		release?: Release | Types.ObjectId;
		backglass?: Backglass | Types.ObjectId;
		user?: User | Types.ObjectId;
		game_request?: GameRequest | Types.ObjectId;
		build?: Build | Types.ObjectId;
	};
	event: string;
	payload: any;
	is_public: boolean;
	ip: string;
	logged_at: Date;

	// serialized
	actor: User;
	ref?: {
		game?: Game;
		release?: Release;
		backglass?: Backglass;
		user?: User;
		game_request?: GameRequest;
		build?: Build;
	};
}
