import { Document, Schema } from 'mongoose';
import { User } from '../users/user.type';
import { ReleaseVersion } from './release.version.type';
import { ReleaseAuthor } from './release.author.type';

export interface Release extends Document {
	id: string,
	name: string,
	name_sortable: string,
	license: 'by-sa' | 'by-nd',
	description: string,
	versions: ReleaseVersion[],
	authors: ReleaseAuthor[],
	_tags: any, // todo Tag[] | Schema.Types.ObjectId
	links: {
		label: string,
		url: string
	}[],
	acknowledgements: string,
	original_version: {
		_ref: Release | Schema.Types.ObjectId,
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
	_created_by: User | Schema.Types.ObjectId
}