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

import Application = require('koa');
import Router from 'koa-router';
import mongoose from 'mongoose';

import { EndPoint } from '../common/api.endpoint';
import { state } from '../state';
import { gameApiRouter } from './game.api.router';
import { GameDocument } from './game.document';
import { GameModel, gameSchema } from './game.schema';
import { GameSerializer } from './game.serializer';

export class GamesApiEndPoint extends EndPoint {

	public readonly name: string = 'Games API';

	public getRouter(): Router {
		return gameApiRouter;
	}

	public async register(app: Application): Promise<void> {
		state.models.Game = mongoose.model<GameDocument, GameModel>('Game', gameSchema);
		state.serializers.Game = new GameSerializer();
	}
}
