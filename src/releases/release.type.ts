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

import { Types } from 'mongoose';
import { Moderated } from '../common/mongoose-plugins/moderate.type';
import { User } from '../users/user.type';
import { ReleaseVersion } from './release.version.type';
import { ContentAuthor } from '../users/content.author.type';
import { Tag } from '../tags/tag.type';
import { GameReference } from '../common/mongoose-plugins/game-ref';

export interface Release extends Moderated, GameReference {
	id: string,
	name: string,
	name_sortable: string,
	license: 'by-sa' | 'by-nd',
	description: string,
	versions: ReleaseVersion[],
	authors: ContentAuthor[],
	_tags: Tag[] | Types.ObjectId
	links: {
		label: string,
		url: string
	}[],
	acknowledgements: string,
	original_version: {
		_ref: Release | Types.ObjectId,
		release: {
			name: string,
			url: string,
		}
	},
	counter: {
		downloads: number,
		comments: number,
		stars: number,
		views: number,
	},
	metrics: {
		popularity: number,
	},
	rating: {
		average: number,
		votes: number,
		score: number,
	},
	released_at: Date,
	modified_at: Date,
	created_at: Date,
	_created_by: User | Types.ObjectId
}