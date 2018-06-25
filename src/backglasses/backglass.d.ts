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

import {
	FileReferenceDocument,
	GameReferenceDocument,
	MetricsDocument,
	ModeratedDocument,
	PrettyIdDocument,
	Types
} from 'mongoose';
import { User } from '../users/user';
import { BackglassVersion } from './backglass.version';
import { ContentAuthor } from '../users/content.author';

export interface Backglass extends ModeratedDocument, GameReferenceDocument, PrettyIdDocument, MetricsDocument, FileReferenceDocument {
	id: string;
	versions: BackglassVersion[];
	description: { type: String };
	authors: ContentAuthor[];
	acknowledgements: string;
	counter: {
		stars: number;
	};
	created_at: Date;
	_created_by: User | Types.ObjectId;

	// serialized
	created_by: User;

	isCreatedBy(user:User):boolean;
}