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

import { Document, Types } from 'mongoose';
import { FileDocument } from '../files/file.document';
import { GameDocument } from '../games/game.document';
import { ReleaseDocument } from './release.document';
import { ReleaseVersionFileDocument } from './version/file/release.version.file.document';
import { ReleaseVersionDocument } from './version/release.version.document';

export interface TableBlock extends Document {
	hash: Buffer;
	bytes: number;
	type: 'image' | 'sound' | 'gameitem' | 'collection';
	meta: any;
	_files?: FileDocument[] | Types.ObjectId[];
}

export interface TableBlockMatchResult extends TableBlockBase {
	matches?: TableBlockMatch[];
}

export interface TableBlockMatch extends TableBlockBase {
	matchedCount: number;
	matchedBytes: number;
	countPercentage: number;
	bytesPercentage: number;
}

export interface TableBlockBase {
	release?: ReleaseDocument;
	game?: GameDocument;
	version?: ReleaseVersionDocument;
	file?: ReleaseVersionFileDocument;
}
