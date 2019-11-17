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

import {
	FileReferenceDocument,
	GameReferenceDocument,
	MetricsDocument,
	ModeratedDocument,
	PrettyIdDocument,
	Types,
} from 'mongoose';
import { Thumb } from '../common/typings/serializers';
import { TagDocument } from '../tags/tag.document';
import { AuthoredEntity } from '../users/authored-entity';
import { ContentAuthor } from '../users/content.author';
import { UserDocument } from '../users/user.document';
import { ReleaseFileFlavor } from './version/file/release.version.file.document';
import { ReleaseVersionDocument } from './version/release.version.document';

export interface ReleaseDocument extends ModeratedDocument, GameReferenceDocument, PrettyIdDocument, MetricsDocument, FileReferenceDocument, AuthoredEntity {

	// from model
	id: string;
	name: string;
	name_sortable: string;
	license: 'by-sa' | 'by-nd';
	description: string;
	versions: ReleaseVersionDocument[];
	authors: ContentAuthor[];
	_tags: TagDocument[] | Types.ObjectId[];
	links: Array<{
		label: string;
		url: string
	}>;
	acknowledgements: string;
	original_version: {
		_ref: ReleaseDocument | Types.ObjectId;
		release: {
			name: string;
			url: string;
		};
	};
	counter: { [T in ReleaseCounterType]: number; };
	metrics: {
		popularity: number;
	};
	rating: {
		average: number;
		votes: number;
		score: number;
	};
	_created_by: UserDocument | Types.ObjectId;

	// serialized
	tags: TagDocument[];
	released_at: Date;
	modified_at: Date;
	created_at: Date;
	created_by: UserDocument;

	// generated
	thumb?: { image: Thumb, flavor: ReleaseFileFlavor };
	starred: boolean;

	// posted
	ipdb: {
		number: number,
		mfg?: number,
		rating?: number,
	};

	/**
	 * @see [[Release.getFileIds]]
	 */
	getFileIds(): string[];

	/**
	 * @see [[Release.getPlayfieldImageIds]]
	 */
	getPlayfieldImageIds(): string[];

	/**
	 * @see [[Release.isCreatedBy]]
	 */
	isCreatedBy(user: UserDocument): boolean;

}

export type ReleaseCounterType = 'downloads' | 'comments' | 'stars' | 'views';
