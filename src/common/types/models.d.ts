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
import { Build } from '../../builds/build';
import { Comment } from '../../comments/comment';
import { File } from '../../files/file';
import { GameRequest } from '../../game-requests/game.request';
import { Rating } from '../../ratings/rating';
import { TableBlock } from '../../releases/release.tableblock';
import { Tag } from '../../tags/tag';
import { Token } from '../../tokens/token';
import { Star } from '../../stars/star';
import { User } from '../../users/user';

import { GameModel } from '../../games/game.schema';
import { BackglassModel } from '../../backglasses/backglass.schema';
import { LogEventModel } from '../../log-event/log.event.schema';
import { LogUserModel } from '../../log-user/log.user.schema';
import { MediumModel } from '../../media/medium.schema';
import { ReleaseModel } from '../../releases/release.schema';
import { ReleaseVersionModel } from '../../releases/release.version.schema';
import { ReleaseVersionFileModel } from '../../releases/release.version.file.schema';
import { RomModel } from '../../roms/rom.schema';

export interface Models {
	Backglass: BackglassModel;
	Build: Model<Build>;
	Comment: Model<Comment>;
	File: Model<File>;
	Game: GameModel;
	GameRequest: Model<GameRequest>;
	LogEvent: LogEventModel;
	LogUser: LogUserModel;
	Medium: MediumModel;
	Rating: Model<Rating>;
	Release: ReleaseModel;
	ReleaseVersion: ReleaseVersionModel;
	ReleaseVersionFile: ReleaseVersionFileModel;
	Rom: RomModel;
	TableBlock: Model<TableBlock>;
	Tag: Model<Tag>;
	Token: Model<Token>;
	Star: Model<Star>;
	User: Model<User>;
}