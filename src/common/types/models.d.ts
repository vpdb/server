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

import { Model } from 'mongoose';
import { Backglass } from '../../backglasses/backglass';
import { Build } from '../../builds/build';
import { Comment } from '../../comments/comment';
import { File } from '../../files/file';
import { Game } from '../../games/game';
import { GameRequest } from '../../game-requests/game.request';
import { LogEvent } from '../../log-event/log.event';
import { LogUser } from '../../log-user/log.user';
import { Medium } from '../../media/medium';
import { Rating } from '../../ratings/rating';
import { Release } from '../../releases/release';
import { Rom } from '../../roms/rom';
import { TableBlock } from '../../releases/release.tableblock';
import { Tag } from '../../tags/tag';
import { Token } from '../../tokens/token';
import { Star } from '../../stars/star';
import { User } from '../../users/user';

export interface Models {
	Backglass: Model<Backglass>;
	Build: Model<Build>;
	Comment: Model<Comment>;
	File: Model<File>;
	Game: Model<Game>;
	GameRequest: Model<GameRequest>;
	LogEvent: Model<LogEvent>;
	LogUser: Model<LogUser>;
	Medium: Model<Medium>;
	Rating: Model<Rating>;
	Release: Model<Release>;
	Rom: Model<Rom>;
	TableBlock: Model<TableBlock>;
	Tag: Model<Tag>;
	Token: Model<Token>;
	Star: Model<Star>;
	User: Model<User>;
}