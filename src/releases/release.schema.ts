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


import { GameReferenceModel, ModeratedDocument, ModeratedModel, PaginateModel, PrettyIdModel, Schema, MetricsModel } from 'mongoose';
import { isArray, compact, map, flatten, uniq } from 'lodash';
import uniqueValidatorPlugin from 'mongoose-unique-validator';
import paginatePlugin from 'mongoose-paginate';

import { authorSchema } from '../users/content.author.schema';
import { releaseVersionSchema } from './release.version.schema';
import { gameReferencePlugin } from '../common/mongoose/game.reference.plugin';
import { fileReferencePlugin } from '../common/mongoose/file.reference.plugin';
import { prettyIdPlugin } from '../common/mongoose/pretty.id.plugin';
import { moderationPlugin } from '../common/mongoose/moderation.plugin';
import { metricsPlugin } from '../common/mongoose/metrics.plugin';
import { sortableTitlePlugin } from '../common/mongoose/sortable.title.plugin';
import { idReferenceValidatorPlugin } from '../common/mongoose/id.reference.validator.plugin';

import { state } from '../state';
import { logger } from '../common/logger';
import { Release } from './release';
import { User } from '../users/user';
import { ReleaseDocument } from './release.document';

const shortId = require('shortid32');

const licenses = [ 'by-sa', 'by-nd' ];

//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------

export const releaseFields = {
	id:            { type: String, required: true, unique: true, 'default': shortId.generate },
	name:          { type: String, required: 'Name must be provided.' },
	name_sortable: { type: String, index: true },
	license:       { type: String, required: 'Mod permission must be provided.', 'enum': { values: licenses, message: 'Invalid license. Valid licenses are: ["' +  licenses.join('", "') + '"].' }},
	description:   { type: String },
	versions:      { type: [ releaseVersionSchema ], validate: { validator: nonEmptyArray, message: 'You must provide at least one version for the release.' } },
	authors:       { type: [ authorSchema ], validate: { validator: nonEmptyArray, message: 'You must provide at least one author.' } }, // TODO limit to let's say 10 max
	_tags:       [ { type: String, ref: 'Tag' } ],
	links: [ {
		label: { type: String },
		url: { type: String }
	} ],
	acknowledgements: { type: String },
	original_version: {
		_ref: { type: Schema.Types.ObjectId, ref: 'Release' },
		release: {
			name: { type: String },
			url: { type: String }
		}
	},
	counter: {
		downloads: { type: Number, 'default': 0 },
		comments:  { type: Number, 'default': 0 },
		stars:     { type: Number, 'default': 0 },
		views:     { type: Number, 'default': 0 }
	},
	metrics: {
		popularity: { type: Number, 'default': 0 } // time-decay based score like reddit, but based on views, downloads, comments, favs. see SO/11653545
	},
	rating: {
		average:   { type: Number, 'default': 0 },
		votes:     { type: Number, 'default': 0 },
		score:     { type: Number, 'default': 0 } // imdb-top-250-like score, a bayesian estimate.
	},
	released_at:   { type: Date, index: true },
	modified_at:   { type: Date, required: true },
	created_at:    { type: Date, required: true },
	_created_by:   { type: Schema.Types.ObjectId, required: true, ref: 'User' }
};

export interface ReleaseModel extends GameReferenceModel<Release>, PrettyIdModel<Release>, ModeratedModel<Release>, PaginateModel<Release>, MetricsModel<Release> { }
export const releaseSchema = new Schema(releaseFields, { toObject: { virtuals: true, versionKey: false } });

//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------
releaseSchema.plugin(gameReferencePlugin);
releaseSchema.plugin(uniqueValidatorPlugin, { message: 'The {PATH} "{VALUE}" is already taken.' });
releaseSchema.plugin(fileReferencePlugin);
releaseSchema.plugin(prettyIdPlugin, { model: 'Release', ignore: ['_created_by', '_tags'] });
releaseSchema.plugin(idReferenceValidatorPlugin, { fields: ['_tags'] });
releaseSchema.plugin(paginatePlugin);
releaseSchema.plugin(moderationPlugin);
releaseSchema.plugin(metricsPlugin, { hotness: { popularity: { views: 1, downloads: 10, comments: 20, stars: 30 } } });
releaseSchema.plugin(sortableTitlePlugin, { src: 'name', dest: 'name_sortable' });

//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
function nonEmptyArray(value: any) {
	return isArray(value) && value.length > 0;
}

releaseSchema.path('versions').validate(function () {
	const ids = compact(map(flatten(map(this.versions, 'files')), '_file')).map(id => id.toString());
	if (uniq(ids).length !== ids.length) {
		this.invalidate('versions', 'You cannot reference a file multiple times.');
	}
	return true;
});

//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------
releaseSchema.methods.moderationChanged = async function (previousModeration: { isApproved: boolean, isRefused: boolean }, moderation: { isApproved: boolean, isRefused: boolean }): Promise<ModeratedDocument> {
	return ReleaseDocument.moderationChanged(this, previousModeration, moderation);
};
releaseSchema.methods.getFileIds = function (): string[] {
	return ReleaseDocument.getFileIds(this);
};
releaseSchema.methods.getPlayfieldImageIds = function (): string[] {
	return ReleaseDocument.getPlayfieldImageIds(this);
};
releaseSchema.methods.isCreatedBy = function (user: User): boolean {
	return ReleaseDocument.isCreatedBy(this, user);
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
releaseSchema.pre('remove', async function (this: Release) {

	// remove linked comments
	state.models.Comment.remove({ $or: [{ '_ref.release': this._id }, { '_ref.release_moderation': this._id }] }).exec();

	// remove table blocks
	let fileIds: string[] = [];
	this.versions.forEach(version => {
		version.files.forEach(file => {
			fileIds.push(file._file._id);
		});
	});
	logger.info('[Release.remove] Removing all table blocks for file IDs [ %s ]', fileIds.map(fid => fid.toString()).join(', '));

	for (let fileId of fileIds) {
		await state.models.TableBlock.update(
			{ _files: fileId },
			{ $pull: { _files: fileId } },
			{ multi: true }
		);
	}
	await state.models.TableBlock.remove({ _files: { $size: 0 } }).exec();
});
