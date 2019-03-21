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

import { AuthenticationEndPoint, AuthenticationStorageEndPoint } from '../authentication';
import { BackglassEndPoint } from '../backglasses';
import { BuildApiEndPoint } from '../builds';
import { CommentEndPoint } from '../comments';
import { FilesApiEndPoint, FilesProtectedStorageEndPoint, FilesPublicStorageEndPoint } from '../files';
import { GameRequestApiEndPoint } from '../game-requests';
import { GamesApiEndPoint } from '../games';
import { LogEventEndPoint } from '../log-event';
import { LogUserEndPoint } from '../log-user';
import { MediaApiEndPoint } from '../media';
import { MiscEndPoint } from '../misc';
import { ProfileEndPoint } from '../profile';
import { RatingEndPoint } from '../ratings';
import { ReleaseEndPoint, ReleaseStorageEndPoint } from '../releases';
import { RomApiEndPoint } from '../roms';
import { StarEndPoint } from '../stars';
import { TagApiEndPoint } from '../tags';
import { TokenEndPoint } from '../tokens';
import { UserEndPoint } from '../users';
import { VpApiEndPoint } from '../vp';
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
	new VpApiEndPoint(),
];
