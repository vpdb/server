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

import { AuthenticationEndPoint, AuthenticationStorageEndPoint } from '../authentication/index';
import { BackglassEndPoint } from '../backglasses/index';
import { BuildApiEndPoint } from '../builds/index';
import { CommentEndPoint } from '../comments/index';
import { FilesApiEndPoint, FilesProtectedStorageEndPoint, FilesPublicStorageEndPoint } from '../files/index';
import { GameRequestApiEndPoint } from '../game-requests/index';
import { GamesApiEndPoint } from '../games/index';
import { LogEventEndPoint } from '../log-event/index';
import { LogUserEndPoint } from '../log-user/index';
import { MediaApiEndPoint } from '../media/index';
import { MiscEndPoint } from '../misc/index';
import { ProfileEndPoint } from '../profile/index';
import { RatingEndPoint } from '../ratings/index';
import { ReleaseEndPoint, ReleaseStorageEndPoint } from '../releases/index';
import { RomApiEndPoint } from '../roms/index';
import { StarEndPoint } from '../stars/index';
import { TagApiEndPoint } from '../tags/index';
import { TokenEndPoint } from '../tokens/index';
import { UserEndPoint } from '../users/index';
import { EndPoint } from './api.endpoint';

export const endPoints: EndPoint[] = [
	new AuthenticationEndPoint(),
	new AuthenticationStorageEndPoint(),
	new BackglassEndPoint(),
	new BuildApiEndPoint(),
	new CommentEndPoint(),
	new FilesApiEndPoint(),
	new FilesPublicStorageEndPoint(),
	new FilesProtectedStorageEndPoint(),
	new GamesApiEndPoint(),
	new GameRequestApiEndPoint(),
	new LogEventEndPoint(),
	new LogUserEndPoint(),
	new MediaApiEndPoint(),
	new MiscEndPoint(),
	new ProfileEndPoint(),
	new RatingEndPoint(),
	new ReleaseEndPoint(),
	new ReleaseStorageEndPoint(),
	new RomApiEndPoint(),
	new StarEndPoint(),
	new TagApiEndPoint(),
	new TokenEndPoint(),
	new UserEndPoint(),
];
