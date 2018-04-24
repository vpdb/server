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
import { Backglass } from '../../backglasses/backglass.type';
import { Build } from '../../builds/build.type';
import { Comment } from '../../comments/comment.type';
import { File } from '../../files/file.type';
import { Game } from '../../games/game.type';
import { GameRequest } from '../../game-requests/game.request.type';
import { LogEvent } from '../../log-event/log.event.type';
import { LogUser } from '../../log-user/log.user.type';
import { Medium } from '../../media/medium.type';
import { Rating } from '../../ratings/rating.type';
import { Release } from '../../releases/release.type';
import { Rom } from '../../roms/rom.type';
import { Tag } from '../../tags/tag.type';
import { Token } from '../../tokens/token.type';
import { Star } from '../../stars/star.type';
import { User } from '../../users/user.type';

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
	Tag: Model<Tag>;
	Token: Model<Token>;
	Star: Model<Star>;
	User: Model<User>;
}