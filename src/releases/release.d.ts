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

import { Schema } from 'mongoose';
import { Moderated } from '../common/mongoose-plugins/moderate';
import { User } from '../users/user';
import { ReleaseVersion } from './release.version';
import { ContentAuthor } from '../users/content.author';
import { Tag } from '../tags/tag';
import { GameReference } from '../common/mongoose-plugins/game-ref';
import { Thumb } from '../common/types/serializers';
import { ReleaseFileFlavor } from './release.version.file';

export interface Release extends Moderated, GameReference {

	// from model
	id: string;
	name: string;
	name_sortable: string;
	license: 'by-sa' | 'by-nd';
	description: string;
	versions: ReleaseVersion[];
	authors: ContentAuthor[];
	_tags: Tag[] | Schema.Types.ObjectId;
	links: {
		label: string;
		url: string
	}[];
	acknowledgements: string;
	original_version: {
		_ref: Release | Schema.Types.ObjectId;
		release: {
			name: string;
			url: string;
		};
	};
	counter: {
		downloads: number;
		comments: number;
		stars: number;
		views: number;
	};
	metrics: {
		popularity: number;
	};
	rating: {
		average: number;
		votes: number;
		score: number;
	};
	_created_by: User | Schema.Types.ObjectId;

	// serialized
	tags: Tag[];
	released_at: Date;
	modified_at: Date;
	created_at: Date;
	created_by: User;

	// generated
	thumb?: { image: Thumb, flavor: ReleaseFileFlavor };
	starred: boolean;
}