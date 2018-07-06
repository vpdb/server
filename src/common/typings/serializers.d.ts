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

import { BackglassSerializer } from '../../backglasses/backglass.serializer';
import { BackglassVersionSerializer } from '../../backglasses/backglass.version.serializer';
import { BuildSerializer } from '../../builds/build.serializer';
import { CommentSerializer } from '../../comments/comment.serializer';
import { ContentAuthorSerializer } from '../../users/content.author.serializer';
import { FileSerializer } from '../../files/file.serializer';
import { GameSerializer } from '../../games/game.serializer';
import { GameRequestSerializer } from '../../game-requests/game.request.serializer';
import { LogEventSerializer } from '../../log-event/log.event.serializer';
import { LogUserSerializer } from '../../log-user/log.user.serializer';
import { MediumSerializer } from '../../media/medium.serializer';
import { ReleaseSerializer } from '../../releases/release.serializer';
import { ReleaseVersionSerializer } from '../../releases/version/release.version.serializer';
import { ReleaseVersionFileSerializer } from '../../releases/version/file/release.version.file.serializer';
import { RomSerializer } from '../../roms/rom.serializer';
import { TagSerializer } from '../../tags/tag.serializer';
import { TokenSerializer } from '../../tokens/token.serializer';
import { UserSerializer } from '../../users/user.serializer';

export interface Serializers {
	Backglass: BackglassSerializer;
	BackglassVersion: BackglassVersionSerializer;
	Build: BuildSerializer;
	Comment: CommentSerializer;
	ContentAuthor: ContentAuthorSerializer;
	File: FileSerializer;
	Game: GameSerializer;
	GameRequest: GameRequestSerializer;
	LogEvent: LogEventSerializer;
	LogUser: LogUserSerializer;
	Medium: MediumSerializer;
	Release: ReleaseSerializer;
	ReleaseVersion: ReleaseVersionSerializer;
	ReleaseVersionFile: ReleaseVersionFileSerializer;
	Rom: RomSerializer;
	Tag: TagSerializer;
	Token: TokenSerializer;
	User: UserSerializer;
}

export interface Thumb {
	url: string;
	width: number;
	height: number;
	is_protected: boolean;
	mime_type?: string;
	bytes?: number;
	file_type?: string;
}