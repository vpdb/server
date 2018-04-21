import { Types } from 'mongoose';
import { Moderated } from '../common/mongoose-plugins/moderate';
import { User } from '../users/user.type';
import { ReleaseVersion } from './release.version.type';
import { ReleaseAuthor } from './release.author.type';
import { Tag } from '../tags/tag.type';

export interface Release extends Moderated {
	id: string,
	name: string,
	name_sortable: string,
	license: 'by-sa' | 'by-nd',
	description: string,
	versions: ReleaseVersion[],
	authors: ReleaseAuthor[],
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