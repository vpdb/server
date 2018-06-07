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

import { config } from '../common/settings';
import { Game } from './game';

/**
 * Contains the Game's instance methods so they can also be accessed
 * from dehydrated objects.
 */
export class GameDocument {

	/**
	 * @see [[Game.isRestricted]]
	 */
	public static isRestricted(game:Game, what: 'release' | 'backglass'):boolean {
		return game.ipdb.mpu && config.vpdb.restrictions[what].denyMpu.includes(game.ipdb.mpu);
	}
}